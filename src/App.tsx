import { useState } from "react";
import useSWR from "swr";

const fetcher = (...args: Parameters<typeof fetch>) =>
  fetch(...args).then((res) => res.json());

export default function App() {
  const [domain, setDomain] = useState("");
  const [submittedDomain, setSubmittedDomain] = useState("");

  const { data, error, isLoading } = useSWR(
    submittedDomain
      ? `https://domain-expiry-lookup.vercel.app/${submittedDomain}`
      : null,
    fetcher
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedDomain(domain);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Domain Expiry Lookup</h1>

      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="Enter domain (e.g. example.com)"
            className="flex-1 p-2 border rounded"
            required
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Search
          </button>
        </div>
      </form>

      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded">
          Failed to load domain information
        </div>
      )}
      {isLoading && <div className="p-4 bg-gray-100 rounded">Loading...</div>}

      {data && !isLoading && (
        <div className="bg-white rounded shadow p-6">
          <h2 className="text-xl font-bold mb-4">{data.domain}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Registration Details</h3>
              <p>
                <span className="font-medium">Registrar:</span>{" "}
                {data.registrar || "N/A"}
              </p>
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
              <p>
                <span className="font-medium">Status:</span>{" "}
                {data.status?.join(", ") || "N/A"}
              </p>
              <p>
                <span className="font-medium">DNSSEC:</span>{" "}
                {data.dnssec ? "Enabled" : "Disabled"}
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">DNS Information</h3>
              <p>
                <span className="font-medium">Nameservers:</span>{" "}
                {data.nameservers?.join(", ") || "N/A"}
              </p>

              {data.dns_records && (
                <>
                  <p className="mt-2 font-medium">A Records:</p>
                  <ul className="list-disc pl-5">
                    {data.dns_records.a?.map((record: string, i: number) => (
                      <li key={i}>{record}</li>
                    )) || <li>None</li>}
                  </ul>

                  <p className="mt-2 font-medium">MX Records:</p>
                  <ul className="list-disc pl-5">
                    {data.dns_records.mx?.map((record: string, i: number) => (
                      <li key={i}>{record}</li>
                    )) || <li>None</li>}
                  </ul>

                  <p className="mt-2 font-medium">TXT Records:</p>
                  <ul className="list-disc pl-5">
                    {data.dns_records.txt?.map((record: string, i: number) => (
                      <li key={i} className="break-all">
                        {record}
                      </li>
                    )) || <li>None</li>}
                  </ul>
                </>
              )}
            </div>
          </div>

          <p className="text-sm text-gray-500 mt-4">
            Last queried: {formatDate(data.last_queried)}
          </p>
        </div>
      )}
    </div>
  );
}
