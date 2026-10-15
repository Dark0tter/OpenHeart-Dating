/** The ribbon-heart logo. The keyhole follows the text color so it shows on light and dark themes. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="60 70 392 400"
      className={className}
      aria-hidden
      focusable="false"
    >
      <g
        fill="none"
        strokeWidth="58"
        strokeLinecap="round"
        transform="translate(0 -22)"
      >
        <path
          d="M276 196C282 146 318 116 354 116C404 116 430 158 430 204C430 266 376 324 206 452"
          stroke="#db5f5f"
        />
        <path
          d="M236 196C230 146 194 116 158 116C108 116 82 158 82 204C82 266 136 324 306 452"
          stroke="#fa9285"
        />
      </g>
      <path
        d="M256 222a28 28 0 0 1 16.4 50.7L282 322H230l9.6-49.3A28 28 0 0 1 256 222z"
        fill="currentColor"
      />
    </svg>
  );
}
