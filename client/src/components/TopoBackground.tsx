export default function TopoBackground() {
  return (
    <svg
      className="topo-bg"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id="topo" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
          <path
            d="M0 100 Q50 60 100 100 T200 100 M0 50 Q50 10 100 50 T200 50 M0 150 Q50 110 100 150 T200 150"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
          <ellipse cx="100" cy="100" rx="70" ry="40" fill="none" stroke="currentColor" strokeWidth="0.8" />
          <ellipse cx="50" cy="50" rx="35" ry="20" fill="none" stroke="currentColor" strokeWidth="0.6" />
          <ellipse cx="150" cy="150" rx="45" ry="25" fill="none" stroke="currentColor" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#topo)" />
    </svg>
  );
}
