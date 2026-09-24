export function Toggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="setting-row">
      <div>
        <strong>{label}</strong>
        <p>{description}</p>
      </div>
      <button
        type="button"
        className={`toggle ${value ? 'on' : ''}`}
        role="switch"
        aria-label={label}
        aria-checked={value}
        onClick={() => onChange(!value)}
      >
        <span />
      </button>
    </div>
  );
}
