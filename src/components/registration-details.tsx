import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, ShieldOff, Shield } from "lucide-react";

export default function RegistrationDetails({
  registrar,
  statusList,
  dnssecEnabled,
}: {
  registrar: string;
  statusList: string[];
  dnssecEnabled: boolean;
}) {
  // Function to determine badge style based on status
  const getStatusStyle = (status: string) => {
    // Apply different styles based on status string
    const statusLower = status.toLowerCase();
    switch (true) {
      case statusLower.includes("hold"):
        return "bg-amber-900/30 text-amber-200 border-amber-700/40 hover:bg-amber-900/40";
      case statusLower.includes("renew"):
        return "bg-sky-900/30 text-sky-200 border-sky-700/40 hover:bg-sky-900/40";
      case statusLower.includes("delete"):
        return "bg-rose-900/30 text-rose-200 border-rose-700/40 hover:bg-rose-900/40";
      case statusLower.includes("transfer"):
        return "bg-violet-900/30 text-violet-200 border-violet-700/40 hover:bg-violet-900/40";
      case statusLower.includes("update"):
        return "bg-emerald-900/30 text-emerald-200 border-emerald-700/40 hover:bg-emerald-900/40";
      default:
        return "bg-gray-800/60 text-gray-300 border-gray-700/40 hover:bg-gray-800/80";
    }
  };

  return (
    <Card className="bg-gray-900 text-gray-100 border-gray-800 shadow-xl overflow-hidden">
      <CardHeader className="border-b border-gray-800">
        <CardTitle className="flex items-center gap-2.5 text-base font-medium">
          <FileText className="h-4.5 w-4.5 text-gray-300" />
          <span>Registration Details</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-gray-800/60">
          {/* Registrar row */}
          <div className="flex items-center px-5 py-4">
            <div className="w-1/3">
              <p className="text-sm text-gray-400 font-medium">Registrar</p>
            </div>
            <div className="w-2/3 flex justify-end">
              <p className="text-lg font-semibold tracking-wide">{registrar}</p>
            </div>
          </div>

          {/* Status row - dynamic status list + DNSSEC */}
          <div className="flex px-5 py-4">
            <div className="w-1/3">
              <p className="text-sm text-gray-400 font-medium pt-1">Status</p>
            </div>
            <div className="w-2/3 flex flex-wrap justify-end gap-2">
              {/* Render dynamic status list */}
              {statusList.map((status, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className={`px-3 py-0.5 text-xs font-medium ${getStatusStyle(
                    status
                  )}`}
                >
                  {status}
                </Badge>
              ))}

              {/* DNSSEC status (with icon) */}
              {dnssecEnabled ? (
                <Badge
                  variant="outline"
                  className="bg-emerald-900/30 text-emerald-200 border-emerald-700/40 hover:bg-emerald-900/40 px-3 py-0.5 text-xs font-medium flex items-center"
                >
                  <Shield className="mr-1.5 h-3 w-3" />
                  DNSSEC
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="bg-rose-900/30 text-rose-200 border-rose-700/40 hover:bg-rose-900/40 px-3 py-0.5 text-xs font-medium flex items-center"
                >
                  <ShieldOff className="mr-1.5 h-3 w-3" />
                  DNSSEC
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
