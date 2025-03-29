import { useState, useMemo } from "react";
import useSWR from "swr";
import { FaBoxOpen, FaServer, FaMailBulk, FaFileAlt } from "react-icons/fa"; // 아이콘 임포트

const fetcher = (...args: Parameters<typeof fetch>) =>
  fetch(...args).then((res) => res.json());

export default function App() {
  const [domain, setDomain] = useState("");
  const [submittedDomain, setSubmittedDomain] = useState("");

  const { data, error, isLoading } = useSWR(
    submittedDomain
      ? `https://domain-expiry-lookup.vercel.app/${submittedDomain}`
      : null,
    fetcher,
    { keepPreviousData: true }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedDomain(domain);
  };

  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        // ISO 8601 형식 등 특정 형식 시도
        const isoDate = new Date(dateString.replace(" ", "T") + "Z"); // 공백 T로 바꾸고 UTC 가정
        if (!isNaN(isoDate.getTime())) {
          return isoDate.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
        }
        return dateString; // 여전히 유효하지 않으면 원본 반환
      }
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const timelineProgress = useMemo(() => {
    // ... (이전과 동일한 계산 로직) ...
    if (!data?.created || !data?.expires) {
      return { createdProgress: 0, isValid: false };
    }
    try {
      const createdDate = new Date(data.created);
      const expiresDate = new Date(data.expires);
      const now = new Date();
      if (isNaN(createdDate.getTime()) || isNaN(expiresDate.getTime())) {
        // 날짜 파싱 실패 시 UTC로 재시도 (WHOIS 데이터 형식 대응)
        const createdDateUTC = new Date(data.created.replace(" ", "T") + "Z");
        const expiresDateUTC = new Date(data.expires.replace(" ", "T") + "Z");
        if (
          isNaN(createdDateUTC.getTime()) ||
          isNaN(expiresDateUTC.getTime())
        ) {
          console.warn(
            "Invalid date format received:",
            data.created,
            data.expires
          );
          return { createdProgress: 0, isValid: false };
        }
        createdDate.setTime(createdDateUTC.getTime());
        expiresDate.setTime(expiresDateUTC.getTime());
      }
      const createdTime = createdDate.getTime();
      const expiresTime = expiresDate.getTime();
      const nowTime = now.getTime();
      const totalDuration = expiresTime - createdTime;
      const elapsedDuration = nowTime - createdTime;
      if (totalDuration <= 0) {
        return {
          createdProgress: nowTime >= expiresTime ? 100 : 0,
          isValid: true,
        };
      }
      const percentage = (elapsedDuration / totalDuration) * 100;
      return {
        createdProgress: percentage,
        isValid: true,
      };
    } catch (e) {
      console.error("Error calculating date progress:", e);
      return { createdProgress: 0, isValid: false };
    }
  }, [data?.created, data?.expires]);

  // 상세 정보 섹션을 위한 아이콘 매핑 (예시)
  const detailIcons = {
    Registrar: <FaBoxOpen className="inline mr-2 text-gray-500" />,
    Status: <FaRegCheckCircle className="inline mr-2 text-gray-500" />, // FaRegCheckCircle 임포트 필요
    DNSSEC: <FaLock className="inline mr-2 text-gray-500" />, // FaLock 임포트 필요
    Nameservers: <FaServer className="inline mr-2 text-gray-500" />,
    ARecords: <FaServer className="inline mr-2 text-gray-500" />, // 아이콘 재활용 또는 다른 아이콘
    MXRecords: <FaMailBulk className="inline mr-2 text-gray-500" />,
    TXTRecords: <FaFileAlt className="inline mr-2 text-gray-500" />,
  };

  return (
    // Tailwind 다크 모드 지원을 위해 html 태그에 'dark' 클래스 추가 필요할 수 있음
    <div className="max-w-3xl mx-auto p-6 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-center">
        Domain Expiry Lookup
      </h1>

      <form onSubmit={handleSubmit} className="mb-6">
        {/* ... (폼 부분 동일) ... */}
        <div className="flex gap-2">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="Enter domain (e.g. example.com)"
            className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:ring-blue-500 focus:border-blue-500"
            required
          />
          <button
            type="submit"
            disabled={isLoading}
            className={`bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
          >
            {isLoading && submittedDomain ? "Searching..." : "Search"}
          </button>
        </div>
      </form>

      {isLoading && submittedDomain && (
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded text-center text-gray-600 dark:text-gray-300">
          Loading domain info for {submittedDomain}...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-200 rounded">
          Failed to load domain information. Please check the domain name and
          try again.
        </div>
      )}

      {data && !isLoading && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-md p-6 animate-fade-in">
          <h2 className="text-xl font-bold mb-2 text-center">{data.domain}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-5">
            Last updated: {formatDate(data.last_queried)}
          </p>

          {/* === Registration Timeline Section === */}
          <div className="mb-6">
            <h3 className="font-semibold mb-1 text-lg">
              Registration Timeline
            </h3>
            {timelineProgress.isValid ? (
              <MilestoneProgressBar
                percentage={timelineProgress.createdProgress}
                startDate={formatDate(data.created)}
                endDate={formatDate(data.expires)}
                // 커스텀 아이콘 예시: startIcon={<FaCalendarCheck size={12}/>}
              />
            ) : (
              // 프로그래스 바 계산 불가 시, 텍스트 정보 표시
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mt-2">
                <p>
                  <span className="font-medium">Created:</span>{" "}
                  {formatDate(data.created)}
                </p>
                <p>
                  <span className="font-medium">Updated:</span>{" "}
                  {formatDate(data.updated)}
                </p>
                <p>
                  <span className="font-medium">Expires:</span>{" "}
                  {formatDate(data.expires)}
                </p>
              </div>
            )}
            {/* Updated 날짜는 타임라인과 별도로 표시 */}
            {timelineProgress.isValid && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                Last Whois Update: {formatDate(data.updated)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* === Registration Details Section === */}
            <div className="bg-white dark:bg-gray-700 p-4 rounded shadow">
              <h3 className="font-semibold mb-3 text-base flex items-center">
                {detailIcons.Registrar} Registration Details
              </h3>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">Registrar:</span>{" "}
                  {data.registrar || "N/A"}
                </p>
                {/* Status 와 DNSSEC 는 타임라인에서 제거하고 여기에 표시 */}
                <p>
                  <span className="font-medium flex items-center">
                    {detailIcons.Status} Status:
                  </span>{" "}
                  <span className="ml-1">
                    {Array.isArray(data.status)
                      ? data.status.join(", ")
                      : data.status || "N/A"}
                  </span>
                </p>
                <p>
                  <span className="font-medium flex items-center">
                    {detailIcons.DNSSEC} DNSSEC:
                  </span>{" "}
                  <span
                    className={`ml-1 font-semibold ${
                      data.dnssec
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {data.dnssec
                      ? "Enabled"
                      : data.dnssec === false
                      ? "Disabled"
                      : "N/A"}
                  </span>
                </p>
              </div>
            </div>

            {/* === DNS Information Section === */}
            <div className="bg-white dark:bg-gray-700 p-4 rounded shadow">
              <h3 className="font-semibold mb-3 text-base flex items-center">
                {detailIcons.Nameservers} DNS Information
              </h3>
              <div className="space-y-3 text-sm">
                <p className="mb-2">
                  <span className="font-medium">Nameservers:</span>{" "}
                  <span className="text-gray-600 dark:text-gray-300">
                    {Array.isArray(data.nameservers)
                      ? data.nameservers.join(", ")
                      : "N/A"}
                  </span>
                </p>

                {/* DNS Record Display */}
                {data.dns_records &&
                Object.keys(data.dns_records).length > 0 ? (
                  <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                    {data.dns_records.a?.length > 0 && (
                      <div>
                        <p className="font-medium text-xs mb-1 flex items-center">
                          {detailIcons.ARecords} A Records:
                        </p>
                        <ul className="list-disc pl-6 text-xs space-y-1 text-gray-600 dark:text-gray-300">
                          {data.dns_records.a.map(
                            (record: string, i: number) => (
                              <li key={`a-${i}`}>{record}</li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                    {data.dns_records.mx?.length > 0 && (
                      <div>
                        <p className="font-medium text-xs mb-1 flex items-center">
                          {detailIcons.MXRecords} MX Records:
                        </p>
                        <ul className="list-disc pl-6 text-xs space-y-1 text-gray-600 dark:text-gray-300">
                          {data.dns_records.mx.map(
                            (record: string, i: number) => (
                              <li key={`mx-${i}`}>{record}</li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                    {data.dns_records.txt?.length > 0 && (
                      <div>
                        <p className="font-medium text-xs mb-1 flex items-center">
                          {detailIcons.TXTRecords} TXT Records:
                        </p>
                        <ul className="list-disc pl-6 text-xs space-y-1 text-gray-600 dark:text-gray-300">
                          {data.dns_records.txt.map(
                            (record: string, i: number) => (
                              <li key={`txt-${i}`} className="break-all">
                                {record}
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-600">
                    No specific DNS records found.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Initial state message */}
      {!submittedDomain && !isLoading && !error && (
        <div className="p-4 bg-blue-50 dark:bg-gray-800 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded text-center">
          Enter a domain name above and click Search to view its registration
          timeline and details.
        </div>
      )}
    </div>
  );
}

// 필요한 react-icons 임포트 추가
import { FaRegCheckCircle, FaLock } from "react-icons/fa";
import MilestoneProgressBar from "./MilestoneProgressBar";
