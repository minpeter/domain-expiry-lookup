import React, { useState, useMemo, useEffect } from "react";
import useSWR from "swr";
import {
  FaCalendarPlus,
  FaCalendarTimes,
  FaBoxOpen,
  FaServer,
  FaMailBulk,
  FaFileAlt,
  FaRegCheckCircle,
  FaLock,
  FaPencilAlt,
  FaQuestionCircle,
  FaHourglassHalf, // 남은 시간 표시용 아이콘 (선택 사항)
} from "react-icons/fa";

// --- Helper: Date comparison ---
const datesAreSignificantlyDifferent = (
  dateStr1: string | undefined | null,
  dateStr2: string | undefined | null,
  thresholdDays = 1
): boolean => {
  if (!dateStr1 || !dateStr2) return false;
  try {
    const date1 = new Date(dateStr1);
    const date2 = new Date(dateStr2);
    if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return false;
    const diffInMs = Math.abs(date1.getTime() - date2.getTime());
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
    return diffInDays >= thresholdDays;
  } catch {
    return false;
  }
};

// --- Helper: Calculate remaining days ---
const calculateRemainingDays = (
  expiryDateStr: string | undefined | null
): { text: string; isExpired: boolean; days: number | null } => {
  if (!expiryDateStr)
    return { text: "No expiry date", isExpired: false, days: null };
  try {
    const now = new Date();
    const expiry = new Date(expiryDateStr);
    if (isNaN(expiry.getTime()))
      return { text: "Invalid date", isExpired: false, days: null };

    // Set 'now' to the start of the day for consistent day difference calculation
    now.setHours(0, 0, 0, 0);
    // Keep expiry time as is, or set to end of day if preferred: expiry.setHours(23, 59, 59, 999);

    const diffInMs = expiry.getTime() - now.getTime();
    const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24)); // Use ceil to count partial days as 1 day remaining

    if (diffInDays <= 0) {
      // Check if expiry was *today* but time has passed, or if it was before today
      const expiryDayStart = new Date(expiryDateStr);
      expiryDayStart.setHours(0, 0, 0, 0);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      if (
        expiryDayStart.getTime() < todayStart.getTime() ||
        new Date().getTime() > expiry.getTime()
      ) {
        return { text: "Expired", isExpired: true, days: 0 };
      } else {
        // Expires today, but later
        return { text: "D-Day", isExpired: false, days: 0 };
      }
    } else if (diffInDays === 1) {
      return { text: "D-1 (1 day left)", isExpired: false, days: 1 };
    } else {
      return {
        text: `D-${diffInDays} (${diffInDays} days left)`,
        isExpired: false,
        days: diffInDays,
      };
    }
  } catch {
    return { text: "Date error", isExpired: false, days: null };
  }
};

// --- MilestoneProgressBar Component ---
interface MilestoneProgressBarProps {
  percentage: number;
  startDate: string; // Formatted for display
  endDate: string; // Formatted for display
  createdDateForCheck: string | undefined | null; // Raw for calc
  updatedDate: string | undefined | null; // Raw for calc
  expiresDateForCalc: string | undefined | null; // Raw for calc
  formatDateFn: (dateString: string | undefined | null) => string;
  startIcon?: React.ReactNode;
  updateIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

// --- Configuration ---
// Percentage of the bar width allocated to the 'created -> updated' period visually.
// The remaining (100 - VISUAL_SPLIT_PERCENT)% will be for 'updated -> expires'.
const VISUAL_SPLIT_PERCENT = 15; // Adjust this value (e.g., 10, 15, 20) to control the visual focus

const MilestoneProgressBar: React.FC<MilestoneProgressBarProps> = ({
  percentage,
  startDate,
  endDate,
  createdDateForCheck,
  updatedDate,
  expiresDateForCalc,
  formatDateFn,
  startIcon = <FaCalendarPlus size={12} />,
  updateIcon = <FaPencilAlt size={11} />,
  endIcon = <FaCalendarTimes size={12} />,
}) => {
  const clampedPercentage = Math.max(0, Math.min(100, percentage));
  const isCompleted = clampedPercentage >= 100;

  const [showUpdateMilestone, setShowUpdateMilestone] = useState(false);
  // This now stores the *VISUAL* position (e.g., 15%) if shown, otherwise irrelevant
  const [updateVisualPositionPercent, setUpdateVisualPositionPercent] =
    useState(VISUAL_SPLIT_PERCENT);
  // This stores the *ACTUAL* position based on time, needed to check if update is active
  // const [updateActualPositionPercent, setUpdateActualPositionPercent] =
  //   useState(50);
  const [updateIsActive, setUpdateIsActive] = useState(false);
  const [formattedUpdateDate, setFormattedUpdateDate] = useState("");

  // Calculate remaining days
  const remainingDaysInfo = useMemo(
    () => calculateRemainingDays(expiresDateForCalc),
    [expiresDateForCalc] // Recalculate only if expiry date changes
    // Note: This won't update automatically *every day* unless the component re-renders.
    // For live daily updates, you might need an effect with a timer or trigger re-render.
  );

  useEffect(() => {
    if (
      createdDateForCheck &&
      updatedDate &&
      expiresDateForCalc &&
      datesAreSignificantlyDifferent(createdDateForCheck, updatedDate)
    ) {
      try {
        const created = new Date(createdDateForCheck);
        const updated = new Date(updatedDate);
        const expires = new Date(expiresDateForCalc);

        if (
          isNaN(created.getTime()) ||
          isNaN(updated.getTime()) ||
          isNaN(expires.getTime())
        ) {
          setShowUpdateMilestone(false);
          return;
        }

        const createdTime = created.getTime();
        const updatedTime = updated.getTime();
        const expiresTime = expires.getTime();
        const totalDuration = expiresTime - createdTime;

        if (
          totalDuration > 0 &&
          updatedTime >= createdTime &&
          updatedTime < expiresTime // Ensure update is strictly before expiry for visual sense
        ) {
          // Calculate ACTUAL position based on time for activation check
          const actualPosition =
            ((updatedTime - createdTime) / totalDuration) * 100;
          const clampedActualPosition = Math.max(
            0.1,
            Math.min(99.9, actualPosition)
          );
          // setUpdateActualPositionPercent(clampedActualPosition);

          // Check if the current progress passes the ACTUAL update point
          setUpdateIsActive(clampedPercentage >= clampedActualPosition);

          // Set the VISUAL position for the icon/label
          setUpdateVisualPositionPercent(VISUAL_SPLIT_PERCENT);

          setShowUpdateMilestone(true);
          setFormattedUpdateDate(formatDateFn(updatedDate));
        } else {
          setShowUpdateMilestone(false);
        }
      } catch (e) {
        console.error("Error calculating update milestone:", e);
        setShowUpdateMilestone(false);
      }
    } else {
      setShowUpdateMilestone(false);
    }
  }, [
    createdDateForCheck,
    updatedDate,
    expiresDateForCalc,
    clampedPercentage,
    formatDateFn,
  ]);

  // Define max-widths for labels based on whether the update milestone is shown
  const startLabelMaxWidth = showUpdateMilestone
    ? `calc(${VISUAL_SPLIT_PERCENT}% - 15px)`
    : "calc(33% - 10px)";
  const updateLabelMaxWidth = `calc(${100 - VISUAL_SPLIT_PERCENT}% - 15px)`; // Max width for update label centered
  const endLabelMaxWidth = showUpdateMilestone
    ? `calc(${100 - VISUAL_SPLIT_PERCENT}% - 15px)`
    : "calc(33% - 10px)";

  return (
    <div className="w-full py-3 px-1">
      {/* Container for the progress bar and milestone icons */}
      <div className="relative h-6 flex items-center mb-1">
        {" "}
        {/* Added mb-1 for space */}
        {/* 1. Bar Track & Fill */}
        <div className="relative w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-0 z-0">
          {/* Progress Fill (Width based on ACTUAL clamped percentage) */}
          <div
            className="absolute top-0 left-0 h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${clampedPercentage}%` }}
            role="progressbar"
            aria-valuenow={clampedPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Domain registration progress"
          ></div>
        </div>
        {/* 2. Milestones Icons Container */}
        <div className="absolute left-0 right-0 top-0 h-full flex items-center px-0 z-10">
          {/* Start Node (Always at 0%) */}
          <div
            className="absolute top-1/2 transform -translate-y-1/2"
            style={{ left: "0%" }}
          >
            <div
              title={`Created: ${startDate}`}
              className={`w-6 h-6 rounded-full flex items-center justify-center shadow border border-gray-200 dark:border-gray-600 ${
                clampedPercentage >= 0 // Start is always active conceptually
                  ? "bg-blue-500 text-white"
                  : "bg-gray-300 text-gray-500" // Should not happen if percentage >= 0
              }`}
            >
              {startIcon}
            </div>
          </div>

          {/* Update Node (Positioned VISUALLY if shown) */}
          {showUpdateMilestone && (
            <div
              className="absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2"
              // Use the visual position state
              style={{ left: `${updateVisualPositionPercent}%` }}
            >
              <div
                title={`Updated: ${formattedUpdateDate}`}
                className={`w-6 h-6 rounded-full flex items-center justify-center shadow border ${
                  updateIsActive // Activation still depends on ACTUAL progress vs ACTUAL position
                    ? "bg-blue-500 text-white border-blue-600"
                    : "bg-white text-gray-400 border-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-500"
                }`}
              >
                {updateIcon}
              </div>
            </div>
          )}

          {/* End Node (Always at 100%) */}
          <div
            className="absolute top-1/2 transform -translate-y-1/2"
            style={{ right: "0%" }} // Equivalent to left: 100%
          >
            <div
              title={`Expires: ${endDate}`}
              className={`w-6 h-6 rounded-full flex items-center justify-center shadow border ${
                isCompleted || remainingDaysInfo.isExpired // Mark as active if completed or expired
                  ? "bg-blue-500 text-white border-blue-600"
                  : "bg-white text-gray-400 border-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-500"
              }`}
            >
              {endIcon}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Labels Container */}
      <div className="relative h-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
        {/* Start Date Label */}
        <span
          className="absolute left-0 text-left truncate"
          style={{ maxWidth: startLabelMaxWidth }}
          title={startDate}
        >
          {startDate}
        </span>

        {/* Update Date Label (Positioned VISUALLY if shown) */}
        {showUpdateMilestone && (
          <span
            className="absolute text-center transform -translate-x-1/2 truncate"
            // Use the visual position state
            style={{
              left: `${updateVisualPositionPercent}%`,
              maxWidth: updateLabelMaxWidth,
            }}
            title={`Updated: ${formattedUpdateDate}`}
          >
            {formattedUpdateDate}
          </span>
        )}

        {/* End Date Label */}
        <span
          className="absolute right-0 text-right truncate"
          style={{ maxWidth: endLabelMaxWidth }}
          title={endDate}
        >
          {endDate}
        </span>
      </div>

      {/* 4. Remaining Days Display */}
      <div className="text-center text-xs mt-2 font-medium text-gray-600 dark:text-gray-300 flex items-center justify-center gap-1">
        <FaHourglassHalf
          className={
            remainingDaysInfo.isExpired ? "text-red-500" : "text-green-600"
          }
        />
        <span
          className={
            remainingDaysInfo.isExpired
              ? "text-red-500"
              : remainingDaysInfo.days !== null && remainingDaysInfo.days < 30
              ? "text-orange-500"
              : "text-green-600"
          }
        >
          {remainingDaysInfo.text}
        </span>
      </div>
    </div>
  );
};
// --- End MilestoneProgressBar Component ---

// --- API Fetcher Function ---
const fetcher = (...args: Parameters<typeof fetch>) =>
  fetch(...args).then((res) => {
    if (!res.ok) {
      // Throw an error for bad responses (4xx, 5xx)
      throw new Error(
        `An error occurred while fetching the data: ${res.statusText}`
      );
    }
    return res.json();
  });

// --- Main App Component ---
export default function App() {
  // State for the input field and the submitted domain
  const [domain, setDomain] = useState("");
  const [submittedDomain, setSubmittedDomain] = useState("");

  // SWR hook for data fetching, caching, and revalidation
  const { data, error, isLoading } = useSWR(
    submittedDomain // Only fetch if a domain has been submitted
      ? `https://domain-expiry-lookup.vercel.app/${submittedDomain}` // API endpoint
      : null, // Don't fetch if submittedDomain is empty
    fetcher, // The function to use for fetching
    {
      keepPreviousData: true, // Keep showing previous data while loading new data
      revalidateOnFocus: false, // Optional: disable revalidation on window focus
      // onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
      //   // Optional: Customize retry logic, e.g., stop retrying after 3 attempts
      //   if (retryCount >= 3) return
      //   // Retry after 5 seconds
      //   setTimeout(() => revalidate({ retryCount }), 5000)
      // }
    }
  );

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission behavior
    setSubmittedDomain(domain.trim().toLowerCase()); // Set the submitted domain (trimmed and lowercase)
  };

  // Date Formatting Function
  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return "N/A"; // Return "N/A" if date string is missing
    try {
      // Common date formats from WHOIS/RDAP might include 'Z' or need 'T' inserted
      const cleanDateString = dateString.endsWith("Z")
        ? dateString
        : dateString.replace(" ", "T") + "Z";
      const date = new Date(cleanDateString);

      // Check if the parsed date is valid
      if (isNaN(date.getTime())) {
        // Try parsing the original string as a fallback
        const maybeDate = new Date(dateString);
        if (isNaN(maybeDate.getTime())) return dateString; // If still invalid, return original string
        // If fallback parsing worked, format it
        return maybeDate.toLocaleDateString(undefined, {
          // Use browser's default locale
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }
      // Format the successfully parsed date
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        // Optional: Include time if needed and available
        // hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
      });
    } catch {
      return dateString; // Return original string if any error occurs during formatting
    }
  };

  // Memoized calculation for timeline progress percentage
  const timelineProgress = useMemo(() => {
    // Need created and expires dates from the API data
    if (!data?.created || !data?.expires) {
      return { createdProgress: 0, isValid: false }; // Not valid if dates are missing
    }
    try {
      // Helper function to parse dates, attempting to handle common formats
      const parseDate = (ds: string) =>
        new Date(ds.endsWith("Z") ? ds : ds.replace(" ", "T") + "Z");
      const createdDate = parseDate(data.created);
      const expiresDate = parseDate(data.expires);
      const now = new Date(); // Current date and time

      // Validate parsed dates
      if (isNaN(createdDate.getTime()) || isNaN(expiresDate.getTime())) {
        console.warn(
          "Invalid date format received after parsing:",
          data.created,
          data.expires
        );
        return { createdProgress: 0, isValid: false };
      }

      // Get timestamps in milliseconds
      const createdTime = createdDate.getTime();
      const expiresTime = expiresDate.getTime();
      const nowTime = now.getTime();
      // Calculate total duration and elapsed duration
      const totalDuration = expiresTime - createdTime;
      const elapsedDuration = nowTime - createdTime;

      // Handle edge case where duration is zero or negative
      if (totalDuration <= 0) {
        // If expired, progress is 100%, otherwise 0%
        return {
          createdProgress: nowTime >= expiresTime ? 100 : 0,
          isValid: true,
        };
      }
      // Calculate progress percentage
      const percentage = (elapsedDuration / totalDuration) * 100;
      // Return clamped percentage and validity flag
      return {
        createdProgress: Math.max(0, Math.min(100, percentage)), // Ensure percentage is 0-100
        isValid: true,
      };
    } catch (e) {
      // Log error and return invalid state if calculation fails
      console.error("Error calculating date progress:", e);
      return { createdProgress: 0, isValid: false };
    }
    // Recalculate only when created or expires dates change
  }, [data?.created, data?.expires]);

  // Define icons for different detail sections for consistency
  const detailIcons = {
    Registrar: (
      <FaBoxOpen
        className="inline mr-2 text-gray-500 dark:text-gray-400"
        aria-hidden="true"
      />
    ),
    Status: (
      <FaRegCheckCircle
        className="inline mr-2 text-gray-500 dark:text-gray-400"
        aria-hidden="true"
      />
    ),
    DNSSEC: (
      <FaLock
        className="inline mr-2 text-gray-500 dark:text-gray-400"
        aria-hidden="true"
      />
    ),
    Nameservers: (
      <FaServer
        className="inline mr-1.5 text-gray-500 dark:text-gray-400"
        aria-hidden="true"
      />
    ),
    ARecords: (
      <FaServer
        className="inline mr-1.5 text-gray-500 dark:text-gray-400"
        aria-hidden="true"
      />
    ), // Can reuse or use different
    MXRecords: (
      <FaMailBulk
        className="inline mr-1.5 text-gray-500 dark:text-gray-400"
        aria-hidden="true"
      />
    ),
    TXTRecords: (
      <FaFileAlt
        className="inline mr-1.5 text-gray-500 dark:text-gray-400"
        aria-hidden="true"
      />
    ),
  };

  // --- JSX Rendering ---
  return (
    // Main container with padding, background colors for light/dark mode
    <div className="max-w-4xl mx-auto p-4 md:p-6 min-h-screen font-sans">
      {/* Application Title */}
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800 dark:text-gray-200">
        Domain Expiry Lookup
      </h1>

      {/* Domain Input Form */}
      <form onSubmit={handleSubmit} className="mb-6 max-w-xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Input Field */}
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="Enter domain (e.g. example.com)"
            className="flex-1 p-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            required // HTML5 required attribute
            aria-label="Domain name input"
          />
          {/* Submit Button */}
          <button
            type="submit"
            // Disable button while loading data
            disabled={isLoading}
            className={`bg-blue-600 text-white px-5 py-2.5 rounded-md hover:bg-blue-700 dark:hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 ease-in-out font-medium`}
          >
            {/* Show different text based on loading state */}
            {isLoading && submittedDomain ? "Searching..." : "Search"}
          </button>
        </div>
      </form>

      {/* Loading State Indicator */}
      {isLoading && submittedDomain && (
        <div className="p-4 bg-blue-50 dark:bg-gray-800 rounded-md text-center text-blue-700 dark:text-blue-300 shadow-sm">
          Loading domain info for{" "}
          <span className="font-semibold">{submittedDomain}</span>...
        </div>
      )}

      {/* Error State Display */}
      {error && (
        // Display error message if fetching fails
        <div
          className="p-4 my-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 rounded-md shadow-sm"
          role="alert"
        >
          <p className="font-medium">Failed to load domain information.</p>
          <p className="text-sm">
            {error.message || "Please check the domain name and try again."}
          </p>
        </div>
      )}

      {/* --- Data Display Area (Rendered when data is available and not loading) --- */}
      {data && !isLoading && (
        // Container for the results with animation
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 animate-fade-in border border-gray-200 dark:border-gray-700">
          {/* Domain Header & Last Queried Info */}
          <div className="text-center mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            {/* Display the queried domain name */}
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
              {data.domain}
            </h2>
            {/* Display last query time and source if available */}
            {data.last_queried && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
                Last queried: {formatDate(data.last_queried)}
                {/* Display query source (WHOIS or RDAP) with styling */}
                {data.query_source && (
                  <span
                    className={`text-xs ml-2 px-2 py-0.5 rounded-full font-medium ${
                      data.query_source === "RDAP"
                        ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200"
                        : "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300"
                    }`}
                  >
                    via{" "}
                    {data.query_source === "WHOIS" ? "WHOIS (Legacy)" : "RDAP"}
                  </span>
                )}
                {/* Handle case where query source might be missing */}
                {!data.query_source && (
                  <span
                    className="text-xs ml-2 px-2 py-0.5 rounded-full font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                    title="Query source unknown"
                  >
                    <FaQuestionCircle
                      className="inline mb-px mr-1"
                      aria-hidden="true"
                    />{" "}
                    via Unknown
                  </span>
                )}
              </p>
            )}
          </div>
          {/* === Registration Timeline Section === */}
          <div className="mb-8">
            <h3 className="font-semibold mb-2 text-lg text-center text-gray-700 dark:text-gray-300">
              Registration Timeline
            </h3>
            {/* Render the MilestoneProgressBar if timeline data is valid */}
            {timelineProgress.isValid ? (
              <MilestoneProgressBar
                percentage={timelineProgress.createdProgress} // Current progress
                startDate={formatDate(data.created)} // Formatted start date
                endDate={formatDate(data.expires)} // Formatted end date
                createdDateForCheck={data.created} // Raw created date for calculation
                updatedDate={data.updated} // Raw updated date for calculation
                expiresDateForCalc={data.expires} // Raw expires date for calculation
                formatDateFn={formatDate} // Pass the formatting function
                // Example of overriding default icons:
                // updateIcon={<FaSyncAlt size={11}/>}
              />
            ) : (
              // Fallback display if timeline cannot be rendered
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mt-2 text-center bg-gray-100 dark:bg-gray-700 p-3 rounded-md">
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
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                  (Could not render timeline due to date issues)
                </p>
              </div>
            )}
          </div>
          {/* === Details Grid (Registration & DNS) === */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 border-t border-gray-200 dark:border-gray-700 pt-6">
            {/* --- Registration Details Card --- */}
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
              {/* Card Title with Icon */}
              <h3 className="font-semibold mb-3 text-base flex items-center text-gray-700 dark:text-gray-300">
                {detailIcons.Registrar} Registration Details
              </h3>
              {/* Details List */}
              <div className="space-y-2.5 text-sm text-gray-800 dark:text-gray-200">
                {/* Registrar */}
                <p>
                  <span className="font-medium text-gray-600 dark:text-gray-400 block text-xs mb-0.5">
                    Registrar
                  </span>
                  {data.registrar || "N/A"}
                </p>
                {/* Status */}
                <p>
                  <span className="font-medium text-gray-600 dark:text-gray-400 flex items-center mb-0.5 text-xs">
                    {detailIcons.Status} Status
                  </span>
                  <span className="ml-1">
                    {Array.isArray(data.status)
                      ? data.status.join(", ")
                      : data.status || "N/A"}
                  </span>
                </p>
                {/* DNSSEC */}
                <p className="flex items-center gap-1">
                  <span className="font-medium text-gray-600 dark:text-gray-400 flex items-center mb-0.5 text-xs">
                    {detailIcons.DNSSEC} DNSSEC:
                  </span>
                  <span
                    className={`ml-1 font-semibold ${
                      data.dnssec
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {/* Display Enabled/Disabled/N/A based on dnssec value */}
                    {data.dnssec === true
                      ? "Enabled"
                      : data.dnssec === false
                      ? "Disabled"
                      : "N/A"}
                  </span>
                </p>
              </div>
            </div>

            {/* --- DNS Information Card --- */}
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
              {/* Card Title with Icon */}
              <h3 className="font-semibold mb-3 text-base flex items-center text-gray-700 dark:text-gray-300">
                {detailIcons.Nameservers} DNS Information
              </h3>
              {/* DNS Details */}
              <div className="space-y-3 text-sm text-gray-800 dark:text-gray-200">
                {/* Nameservers List */}
                <div className="mb-2">
                  <span className="font-medium text-gray-600 dark:text-gray-400 block text-xs mb-0.5">
                    Nameservers
                  </span>
                  <div className="text-gray-700 dark:text-gray-300">
                    {/* Display nameservers or N/A */}
                    {Array.isArray(data.nameservers) &&
                    data.nameservers.length > 0
                      ? data.nameservers.join(", ")
                      : "N/A"}
                  </div>
                </div>

                {/* Specific DNS Record Display (A, MX, TXT) */}
                {/* Check if dns_records object exists and has keys */}
                {data.dns_records &&
                Object.keys(data.dns_records).length > 0 ? (
                  <div className="space-y-3 pt-3 border-t border-gray-300 dark:border-gray-600">
                    {/* A Records */}
                    {data.dns_records.a?.length > 0 && (
                      <div>
                        <p className="font-medium text-xs mb-1 flex items-center text-gray-600 dark:text-gray-400">
                          {detailIcons.ARecords} A Records:
                        </p>
                        <ul className="list-disc pl-6 text-xs space-y-1 text-gray-700 dark:text-gray-300">
                          {/* Map through A records and create list items */}
                          {data.dns_records.a.map(
                            (record: string, i: number) => (
                              <li key={`a-${i}`}>{record}</li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                    {/* MX Records */}
                    {data.dns_records.mx?.length > 0 && (
                      <div>
                        <p className="font-medium text-xs mb-1 flex items-center text-gray-600 dark:text-gray-400">
                          {detailIcons.MXRecords} MX Records:
                        </p>
                        <ul className="list-disc pl-6 text-xs space-y-1 text-gray-700 dark:text-gray-300">
                          {/* Map through MX records */}
                          {data.dns_records.mx.map(
                            (
                              record:
                                | string
                                | { priority?: number; exchange?: string },
                              i: number
                            ) => (
                              <li key={`mx-${i}`}>
                                {/* Handle potential object format for MX records */}
                                {typeof record === "object" && record !== null
                                  ? `${record.priority ?? "?"} ${
                                      record.exchange ?? record
                                    }`
                                  : record}
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                    {/* TXT Records */}
                    {data.dns_records.txt?.length > 0 && (
                      <div>
                        <p className="font-medium text-xs mb-1 flex items-center text-gray-600 dark:text-gray-400">
                          {detailIcons.TXTRecords} TXT Records:
                        </p>
                        <ul className="list-disc pl-6 text-xs space-y-1 text-gray-700 dark:text-gray-300">
                          {/* Map through TXT records */}
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
                    {/* Message if no specific records of these types are found */}
                    {!(
                      data.dns_records.a?.length > 0 ||
                      data.dns_records.mx?.length > 0 ||
                      data.dns_records.txt?.length > 0
                    ) && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                        No A, MX, or TXT records found.
                      </p>
                    )}
                  </div>
                ) : (
                  // Message if the dns_records object itself is missing or empty
                  <p className="text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-300 dark:border-gray-600 italic">
                    No specific DNS records (A, MX, TXT) available.
                  </p>
                )}
              </div>
            </div>
          </div>{" "}
          {/* End of Details Grid */}
        </div> // End of Data Display Area
      )}

      {/* Initial State Message (Shown before first search) */}
      {!submittedDomain && !isLoading && !error && (
        <div className="mt-8 p-4 bg-blue-50 dark:bg-gray-800 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded-md text-center shadow-sm">
          Enter a domain name above and click Search to view its registration
          timeline and details.
        </div>
      )}
    </div> // End of Main Container
  );
}

// --- Optional: CSS for fade-in animation ---
/* Add this to your global CSS file (e.g., index.css or App.css) */
/*
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fadeIn 0.5s ease-out forwards;
}
*/
