import { createElement, type ReactElement } from 'react'
import {
  Box,
  Braces,
  Component,
  Hash,
  ListOrdered,
  Package,
  SquareFunction,
  Tag,
  Type,
  Variable,
  Wrench,
  type LucideIcon
} from 'lucide-react'
import type { CodeSymbolKind } from '@/lib/code-navigation/code-navigation-types'

const CODE_SYMBOL_KIND_ICONS: Record<CodeSymbolKind, LucideIcon> = {
  module: Package,
  namespace: Braces,
  class: Box,
  interface: Component,
  enum: ListOrdered,
  enumMember: Hash,
  type: Type,
  function: SquareFunction,
  method: SquareFunction,
  constructor: Wrench,
  property: Tag,
  field: Tag,
  variable: Variable,
  constant: Variable
}

export function renderCodeSymbolKindIcon(kind: CodeSymbolKind, className: string): ReactElement {
  return createElement(CODE_SYMBOL_KIND_ICONS[kind], { className, 'aria-hidden': true })
}
