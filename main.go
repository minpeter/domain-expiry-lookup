package main

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/araddon/dateparse"
	"github.com/likexian/whois"
	whoisparser "github.com/likexian/whois-parser"
	"github.com/miekg/dns"
	"github.com/openrdap/rdap"
)

type DomainInfo struct {
	Domain      string    `json:"domain"`
	Registrar   string    `json:"registrar"`
	Nameservers []string  `json:"nameservers"`
	DNSSEC      bool      `json:"dnssec"`
	Status      []string  `json:"status"`
	Created     time.Time `json:"created"`
	Updated     time.Time `json:"updated"`
	Expires     time.Time `json:"expires"`
	DNSRecords  DNSData   `json:"dns_records"`
	LastQueried time.Time `json:"last_queried"`
	QuerySource string    `json:"query_source"` // JSON 태그 추가 및 필드 이름 대문자로 변경
}

type DNSData struct {
	A   []string `json:"a"`
	MX  []string `json:"mx"`
	TXT []string `json:"txt"`
}

type LookupError struct {
	Source  string
	Message string
}

func (e *LookupError) Error() string {
	return fmt.Sprintf("%s error: %s", e.Source, e.Message)
}

var (
	cache      = make(map[string]DomainInfo)
	cacheMutex = &sync.RWMutex{}
)

func main() {
	domain := "minpeter.uk"

	info, err := GetDomainInfo(domain)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}

	jsonData, _ := json.MarshalIndent(info, "", "  ")
	fmt.Printf("Domain Report for %s:\n%s\n", domain, string(jsonData))
}

// 개선된 날짜 파싱 함수 --------------------------------------------------------
var whoisDateLayouts = []string{
	"2006. 01. 02", // Korean WHOIS format
	"2006. 01. 02.",
	"2006.01.02.",
	"2006.01.02",               // Compact format
	"2006-01-02",               // ISO basic format
	"02-Jan-2006",              // Abbreviated month name
	"2006/01/02",               // Slash-separated
	"January 2, 2006",          // Full month name
	"02.01.2006",               // German format
	"2006-01-02T15:04:05Z",     // ISO 8601 UTC
	"Mon, 02 Jan 2006",         // RFC 1123
	"1997-September-15",        // Raw format with full month name
	"before Aug-1996",          // Approximate date format
	"29/03/2025",               // European style
	"03/29/2025",               // US style
	"20250329",                 // Compact YYYYMMDD
	"29032025",                 // Compact DDMMYYYY
	"March 29th, 2025",         // Month name with ordinal suffix
	"Saturday, March 29, 2025", // Full weekday included
}

func parseWhoisDate(dateStr string) time.Time {
	dateStr = strings.TrimSpace(dateStr)

	// 기본 형식 시도
	for _, layout := range whoisDateLayouts {
		if t, err := time.Parse(layout, dateStr); err == nil {
			return t.UTC()
		}
	}

	// 변형 형식 시도
	modified := strings.ReplaceAll(dateStr, " ", "")
	if t, err := time.Parse("2006.01.02", modified); err == nil {
		return t.UTC()
	}

	// dateparse 폴백
	if t, err := dateparse.ParseAny(dateStr); err == nil {
		return t.UTC()
	}

	return time.Time{}
}

// 캐시 처리 개선 --------------------------------------------------------------
func getFromCache(domain string) (DomainInfo, bool) {
	cacheMutex.RLock()
	defer cacheMutex.RUnlock()

	entry, exists := cache[domain]
	if !exists {
		return DomainInfo{}, false
	}

	if time.Since(entry.LastQueried) < time.Hour {
		return entry, true
	}

	delete(cache, domain)
	return DomainInfo{}, false
}

// RDAP 조회 로직 보완 ---------------------------------------------------------
func rdapLookup(domain string) (DomainInfo, error) {
	client := rdap.Client{
		HTTP: &http.Client{Timeout: 3 * time.Second},
	}

	response, err := client.QueryDomain(domain)
	if err != nil {
		return DomainInfo{}, &LookupError{
			Source:  "RDAP",
			Message: err.Error(),
		}
	}

	// 등록자 정보 추출 강화
	registrar := ""
	for _, entity := range response.Entities {
		if containsRole(entity.Roles, "registrar") {
			registrar = entity.Handle
			break
		}
	}

	// DNSSEC 처리 보완
	dnssec := false
	if response.SecureDNS != nil && response.SecureDNS.DelegationSigned != nil {
		dnssec = *response.SecureDNS.DelegationSigned
	}

	info := DomainInfo{
		Domain:      domain,
		Registrar:   registrar,
		Nameservers: parseNameservers(response.Nameservers),
		DNSSEC:      dnssec,
		Status:      response.Status,
		QuerySource: "RDAP", // 수정된 부분
	}

	// 이벤트 날짜 처리
	for _, event := range response.Events {
		date, _ := time.Parse(time.RFC3339, event.Date)
		switch event.Action {
		case "registration":
			info.Created = date
		case "expiration":
			info.Expires = date
		case "last changed":
			info.Updated = date
		}
	}

	return info, nil
}

// WHOIS 조회 로직 보완 --------------------------------------------------------
func whoisLookup(domain string) (DomainInfo, error) {
	raw, err := whois.Whois(domain)
	if err != nil {
		return DomainInfo{}, &LookupError{
			Source:  "WHOIS",
			Message: err.Error(),
		}
	}

	parsed, err := whoisparser.Parse(raw)
	if err != nil {
		return DomainInfo{}, &LookupError{
			Source:  "WHOIS Parser",
			Message: err.Error(),
		}
	}

	info := DomainInfo{
		Domain:      domain,
		Registrar:   parsed.Registrar.Name,
		Nameservers: parsed.Domain.NameServers,
		Status:      parsed.Domain.Status,
		QuerySource: "WHOIS", // 수정된 부분
	}

	// 개선된 날짜 파싱 적용
	info.Created = parseWhoisDate(parsed.Domain.CreatedDate)
	info.Updated = parseWhoisDate(parsed.Domain.UpdatedDate)
	info.Expires = parseWhoisDate(parsed.Domain.ExpirationDate)

	return info, nil
}

// 기타 유틸리티 함수 ----------------------------------------------------------
func resolveDNS(domain string) DNSData {
	var data DNSData
	if a, err := net.LookupHost(domain); err == nil {
		data.A = a
	}
	if mx, err := net.LookupMX(domain); err == nil {
		for _, r := range mx {
			data.MX = append(data.MX, r.Host)
		}
	}
	if txt, err := net.LookupTXT(domain); err == nil {
		data.TXT = txt
	}
	return data
}

func checkDNSSEC(domain string) bool {
	m := new(dns.Msg)
	m.SetQuestion(dns.Fqdn(domain), dns.TypeDNSKEY)
	in, err := dns.Exchange(m, "8.8.8.8:53")
	return err == nil && in.AuthenticatedData
}

func addToCache(domain string, info DomainInfo) {
	cacheMutex.Lock()
	defer cacheMutex.Unlock()
	cache[domain] = info
}

func containsRole(roles []string, target string) bool {
	for _, role := range roles {
		if role == target {
			return true
		}
	}
	return false
}

func parseNameservers(ns []rdap.Nameserver) []string {
	var servers []string
	for _, n := range ns {
		servers = append(servers, n.LDHName)
	}
	return servers
}

func GetDomainInfo(domain string) (DomainInfo, error) {
	if cached, ok := getFromCache(domain); ok {
		return cached, nil
	}

	resultChan := make(chan DomainInfo, 2)
	errChan := make(chan error, 2)

	go func() {
		info, err := rdapLookup(domain)
		if err == nil {
			resultChan <- info
		} else {
			errChan <- err
		}
	}()

	go func() {
		info, err := whoisLookup(domain)
		if err == nil {
			resultChan <- info
		} else {
			errChan <- err
		}
	}()

	var info DomainInfo
	select {
	case info = <-resultChan:
		info.LastQueried = time.Now().UTC()
		info.DNSRecords = resolveDNS(domain)
		info.DNSSEC = checkDNSSEC(domain)
		addToCache(domain, info)
		return info, nil
	case <-time.After(5 * time.Second):
		return DomainInfo{}, &LookupError{
			Source:  "System",
			Message: "All lookups timed out",
		}
	}
}
