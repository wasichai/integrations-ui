import type { ReactNode } from 'react'

// radix's select cannot be driven in jsdom (pointer-events: none on its trigger), so tests swap it for a real
// <select>, as wasichai-ui's automation tests do. the trigger's id keeps the <Label htmlFor> link
export async function selectDouble(importOriginal: () => Promise<unknown>) {
  const actual = (await importOriginal()) as Record<string, unknown>
  const find = (node: unknown, prop: 'id' | 'placeholder'): string | undefined => {
    if (Array.isArray(node)) return node.map((child) => find(child, prop)).find(Boolean)
    if (!node || typeof node !== 'object') return undefined
    const props = (node as { props?: Record<string, unknown> }).props
    if (!props) return undefined
    if (typeof props[prop] === 'string') return props[prop] as string
    return find(props.children, prop)
  }
  return {
    ...actual,
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: ({ children }: { children?: ReactNode }) => <>{children}</>,
    SelectItem: ({ value, children }: { value: string; children?: ReactNode }) => <option value={value}>{children}</option>,
    Select: ({
      value,
      onValueChange,
      disabled,
      children
    }: {
      value: string
      onValueChange: (value: string) => void
      disabled?: boolean
      children?: ReactNode
    }) => {
      const id = find(children, 'id')
      return (
        <select id={id} disabled={disabled} value={value} onChange={(event) => onValueChange(event.target.value)}>
          <option value="" />
          {children}
        </select>
      )
    }
  }
}
