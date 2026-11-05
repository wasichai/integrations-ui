import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@wasichai/ui'

// labelled inputs, each with its violation underneath (aria-describedby)

export interface Option {
  value: string
  label: string
}

// radix refuses '' as an item value: '' is "nothing picked", ALL an explicit "no filter"
export const ALL = '@all'

export function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-xs text-danger">
      {message}
    </p>
  ) : null
}

export function Pick({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  error
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  error?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  )
}

export function Text({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
  multiline,
  mono
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  error?: string
  hint?: string
  multiline?: boolean
  mono?: boolean
}) {
  const props = {
    id,
    value,
    onBlur,
    className: mono ? 'font-mono text-xs' : undefined,
    autoComplete: 'off',
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <Textarea {...props} rows={4} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <Input {...props} onChange={(event) => onChange(event.target.value)} />
      )}
      {error ? (
        <FieldError id={`${id}-error`} message={error} />
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
