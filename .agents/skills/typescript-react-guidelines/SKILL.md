---
name: typescript-react-guidelines
description: |
  TypeScript and React coding guidelines enforcing preferred patterns for JS-based projects. Use when writing, reviewing, or refactoring TypeScript, React, JavaScript, or Node.js code. Triggers on: (1) Creating new TypeScript/React components or functions, (2) Refactoring existing code, (3) Code review tasks, (4) Any task involving .ts, .tsx, .js, .jsx files, or package.json/tsconfig.json configuration.
---

# TypeScript & React Coding Guidelines

Apply these patterns when writing TypeScript, React, or JavaScript code.

## Type Definitions

### Use interfaces for object shapes

```typescript
// Prefer
interface UserProps {
  id: string
  name: string
  email?: string
}

// Avoid
type UserProps = {
  id: string
  name: string
  email?: string
}
```

### Use type aliases for unions and primitives

```typescript
// Correct usage of type
type Status = 'idle' | 'loading' | 'success' | 'error'
type MessageRole = 'system' | 'user' | 'assistant'
type ID = string | number
```

### Use discriminated unions for message types

```typescript
type AppMessage =
  | { type: 'FETCH_DATA'; id: string }
  | { type: 'UPDATE_CONFIG'; config: Config }
  | { type: 'ERROR'; error: string }
```

### Use const objects instead of enums

```typescript
// Prefer
const ErrorCode = {
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  TIMEOUT: 'TIMEOUT',
} as const

type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode]

// Avoid
enum ErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  TIMEOUT = 'TIMEOUT',
}
```

## Function Style

### Use arrow functions

```typescript
// Prefer
export const formatDate = (date: Date): string =>
  date.toISOString().split('T')[0]

export const fetchUser = async (id: string) => {
  const response = await fetch(`/api/users/${id}`)
  return response.json()
}

// Avoid
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}
```

### Minimal but strict typing

Let TypeScript infer return types when obvious. Annotate parameters and complex returns.

```typescript
// Prefer: inferred return type
export const sum = (a: number, b: number) => a + b

// Prefer: explicit return for complex types
export const parseConfig = (raw: string): Config | null => {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// Avoid: unnecessary verbosity
export const sum = (a: number, b: number): number => a + b
```

## Code Organization

### Prefer factory functions over classes

```typescript
// Prefer
interface CacheOptions {
  maxSize?: number
  ttl?: number
}

export const createCache = <T>(options: CacheOptions = {}) => {
  const { maxSize = 100, ttl = 60000 } = options
  const cache = new Map<string, { value: T; timestamp: number }>()

  const get = (key: string): T | undefined => {
    const entry = cache.get(key)
    if (!entry) return undefined
    if (Date.now() - entry.timestamp > ttl) {
      cache.delete(key)
      return undefined
    }
    return entry.value
  }

  const set = (key: string, value: T) => {
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value
      cache.delete(firstKey)
    }
    cache.set(key, { value, timestamp: Date.now() })
  }

  const clear = () => cache.clear()

  return { get, set, clear }
}

// Avoid
export class Cache<T> {
  private cache: Map<string, { value: T; timestamp: number }>
  private maxSize: number
  private ttl: number

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize ?? 100
    this.ttl = options.ttl ?? 60000
    this.cache = new Map()
  }
  // ... methods
}
```

### When classes ARE appropriate

Use classes only for:
- React class components (legacy)
- Custom Error types (for stack traces)
- Framework requirements (e.g., decorators)

```typescript
// Acceptable: Custom errors
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}
```

## React Patterns

### Component style

```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary'
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
}

export const Button = ({
  variant = 'primary',
  disabled = false,
  onClick,
  children,
}: ButtonProps) => (
  <button
    className={`btn btn-${variant}`}
    disabled={disabled}
    onClick={onClick}
  >
    {children}
  </button>
)
```

### Hooks

```typescript
interface UseToggleOptions {
  initial?: boolean
}

export const useToggle = ({ initial = false }: UseToggleOptions = {}) => {
  const [value, setValue] = useState(initial)

  const toggle = useCallback(() => setValue(v => !v), [])
  const setTrue = useCallback(() => setValue(true), [])
  const setFalse = useCallback(() => setValue(false), [])

  return { value, toggle, setTrue, setFalse }
}
```

### Prefer Jotai atoms over Context for state

```typescript
// Prefer: Jotai atoms
import { atom, useAtom } from 'jotai'

export const userAtom = atom<User | null>(null)
export const isLoadingAtom = atom(false)

// Derived atom
export const isAuthenticatedAtom = atom(get => get(userAtom) !== null)
```

## Exports

### Use named exports

```typescript
// Prefer
export const formatDate = (date: Date) => { ... }
export const parseDate = (str: string) => { ... }

// Avoid
export default function formatDate(date: Date) { ... }
```

### Barrel files for packages

```typescript
// index.ts
export { formatDate, parseDate } from './date'
export { formatCurrency } from './currency'
export type { DateOptions, CurrencyOptions } from './types'
```

## Error Handling

### Use Result pattern for expected failures

```typescript
interface Result<T, E = Error> {
  success: boolean
  data?: T
  error?: E
}

export const fetchData = async <T>(url: string): Promise<Result<T>> => {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return { success: false, error: new Error(`HTTP ${response.status}`) }
    }
    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error))
    }
  }
}
```

## Quick Reference

| Pattern | Prefer | Avoid |
|---------|--------|-------|
| Object shapes | `interface Foo {}` | `type Foo = {}` |
| Unions | `type Status = 'a' \| 'b'` | `enum Status {}` |
| Functions | `const fn = () => {}` | `function fn() {}` |
| State containers | `createCache()` factory | `class Cache {}` |
| Return types | Infer when obvious | Always annotate |
| Exports | Named exports | Default exports |
| React state | Jotai atoms | Context (when possible) |
