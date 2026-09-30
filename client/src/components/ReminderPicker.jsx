import { useState } from 'react';
import { Button, Form, InputGroup } from 'react-bootstrap';
import { reminderLabel } from '../format';

const PRESETS = [0, 1, 2, 7];

// value: array of daysBefore numbers.
export default function ReminderPicker({ value, onChange, error }) {
  const [custom, setCustom] = useState('');
  const toggle = (d) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => a - b));
  const addCustom = () => {
    const n = Number(custom);
    if (Number.isInteger(n) && n >= 0 && n <= 365 && !value.includes(n)) onChange([...value, n].sort((a, b) => a - b));
    setCustom('');
  };
  const options = [...new Set([...PRESETS, ...value])].sort((a, b) => a - b);

  return (
    <fieldset className="mb-3">
      <legend className="form-label fs-6">Reminders</legend>
      <div className="d-flex flex-wrap gap-3 mb-2">
        {options.map((d) => (
          <Form.Check
            key={d}
            type="checkbox"
            id={`reminder-${d}`}
            label={reminderLabel(d)}
            checked={value.includes(d)}
            onChange={() => toggle(d)}
          />
        ))}
      </div>
      <InputGroup size="sm" style={{ maxWidth: 320 }}>
        <Form.Control
          type="number"
          min="0"
          max="365"
          value={custom}
          placeholder="Custom days before"
          aria-label="Custom reminder, days before"
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
        />
        <Button variant="outline-secondary" onClick={addCustom}>Add</Button>
      </InputGroup>
      {error && <div className="text-danger small mt-1">{error}</div>}
    </fieldset>
  );
}
