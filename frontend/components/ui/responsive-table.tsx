'use client'

import React from 'react'
import { cn } from '@/lib/utils'

/** ---------------------------------------------------------------
 *  ResponsiveTable
 *
 *  Desktop (md+): tabela tradicional com thead/tbody.
 *  Mobile (<md):  cada linha vira um card com borda laranja,
 *                 label automático acima de cada value e a coluna
 *                 de "Ações" fixada no rodapé do card.
 * --------------------------------------------------------------- */

// ─── Contexto interno (repassa os labels do header às células) ───
const HeaderLabelsContext = React.createContext<string[]>([])
const TableRenderModeContext = React.createContext<'desktop' | 'mobile'>('desktop')
const TableSectionContext = React.createContext<'header' | 'body'>('body')

function extractHeaderLabels(children: React.ReactNode): string[] {
  const labels: string[] = []

  React.Children.forEach(children, child => {
    if (!React.isValidElement(child)) return

    const props = child.props as {
      children?: React.ReactNode
      mobileLabel?: string
    }

    if (typeof props.mobileLabel === 'string') {
      labels.push(props.mobileLabel)
      return
    }

    if (typeof props.children === 'string') {
      labels.push(props.children)
      return
    }

    if (props.children) {
      labels.push(...extractHeaderLabels(props.children))
    }
  })

  return labels
}

// ─── Table wrapper ───────────────────────────────────────────────
interface RTableProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}
export function RTable({ children, className, ...props }: RTableProps) {
  const labels = React.useMemo(() => extractHeaderLabels(children), [children])

  return (
    <HeaderLabelsContext.Provider value={labels}>
      <_RTableInner className={className} {...props}>
        {children}
      </_RTableInner>
    </HeaderLabelsContext.Provider>
  )
}

interface _InnerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}
function _RTableInner({ children, className, ...props }: _InnerProps) {
  return (
    <div className={cn('w-full', className)} {...props}>
      {/* Desktop */}
      <TableRenderModeContext.Provider value="desktop">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            {children}
          </table>
        </div>
      </TableRenderModeContext.Provider>
      {/* Mobile: cards — renderiza apenas tbody */}
      <TableRenderModeContext.Provider value="mobile">
        <div className="md:hidden">
          {children}
        </div>
      </TableRenderModeContext.Provider>
    </div>
  )
}

// ─── TableHeader (thead) ─────────────────────────────────────────
interface RTableHeaderProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode
}
export function RTableHeader({ children, className, ...props }: RTableHeaderProps) {
  const mode = React.useContext(TableRenderModeContext)

  if (mode === 'mobile') return null

  return (
    <TableSectionContext.Provider value="header">
      <thead
        className={cn('border-b border-border', className)}
        {...props}
      >
        {children}
      </thead>
    </TableSectionContext.Provider>
  )
}

// ─── TableHead (th) ──────────────────────────────────────────────
interface RTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children?: React.ReactNode
  /** Label exibida no card mobile. Padrão = children como string */
  mobileLabel?: string
}
export function RTableHead({ children, mobileLabel, className, ...props }: RTableHeadProps) {
  const label = mobileLabel ?? (typeof children === 'string' ? children : '')
  return (
    <th
      data-rth
      data-rth-label={label}
      className={cn(
        'text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  )
}

// ─── TableBody (tbody) ───────────────────────────────────────────
interface RTableBodyProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode
}
export function RTableBody({ children, className, ...props }: RTableBodyProps) {
  const mode = React.useContext(TableRenderModeContext)

  if (mode === 'mobile') {
    return (
      <TableSectionContext.Provider value="body">
        <div className={cn(className)} {...props}>
          {children}
        </div>
      </TableSectionContext.Provider>
    )
  }

  return (
    <TableSectionContext.Provider value="body">
      <tbody className={cn('[&>tr:last-child]:border-0', className)} {...props}>
        {children}
      </tbody>
    </TableSectionContext.Provider>
  )
}

// ─── TableRow (tr) ───────────────────────────────────────────────
interface RTableRowProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode
  /** Índice opcional – não usado na renderização, mas útil para key */
  selected?: boolean
  /** Linha de detalhe/expansão: renderiza conteúdo full-width no mobile (sem card) */
  detail?: boolean
}
export function RTableRow({ children, selected, detail, className, ...props }: RTableRowProps) {
  const labels = React.useContext(HeaderLabelsContext)
  const mode = React.useContext(TableRenderModeContext)
  const section = React.useContext(TableSectionContext)

  // Coleta as células filhas em array para poder acessar por índice
  const cells = React.Children.toArray(children)

  const getMobileContent = (cell: React.ReactNode) => {
    if (!React.isValidElement(cell)) return cell
    return (cell.props as { children?: React.ReactNode }).children ?? null
  }

  if (section === 'header') {
    return (
      <tr className={cn('border-b border-border', className)} {...props}>
        {children}
      </tr>
    )
  }

  if (mode === 'desktop') {
    return (
      <tr
        className={cn(
          'border-b border-border transition-colors hover:bg-muted/40',
          selected && 'bg-muted/60',
          className,
        )}
        {...props}
      >
        {children}
      </tr>
    )
  }

  return (
    <>
      {detail ? (
        /* Linha de detalhe no mobile: renderiza o conteúdo das células diretamente */
        <div className="md:hidden border-b border-border bg-slate-50/80 px-4 pb-4 -mt-4 rounded-b-xl mb-5 last:mb-0" {...props}>
          {cells.map((cell, idx) => (
            <React.Fragment key={idx}>{getMobileContent(cell)}</React.Fragment>
          ))}
        </div>
      ) : (
      /* Mobile card */
      <div
        className={cn(
          'md:hidden relative mb-5 flex flex-col gap-1 rounded-xl border border-border bg-card px-4 pt-4 pb-14 last:mb-0',
          'border-l-4 border-l-[#f25c05] shadow-sm',
          selected && 'bg-muted/30',
        )}
        {...props}
      >
        {cells.map((cell, idx) => {
          const label = labels[idx] ?? ''
          const isFirst = idx === 0 && label === ''
          const isActions = idx !== 0 && (label.toLowerCase().includes('aç') || label === '')
          const content = getMobileContent(cell)

          // Primeira coluna (checkbox): posiciona no topo-direita
          if (isFirst) {
            return (
              <div key={idx} className="absolute top-3 right-3">
                {content}
              </div>
            )
          }

          // Coluna de ações: fixa no rodapé do card
          if (isActions) {
            return (
              <div key={idx} className="absolute bottom-3 right-3 flex items-center gap-1">
                {content}
              </div>
            )
          }

          return (
            <div key={idx} className="flex flex-col min-w-0">
              {label && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
                  {label}
                </span>
              )}
              <div className="text-sm text-foreground">{content}</div>
            </div>
          )
        })}
      </div>
      )}
    </>
  )
}

// ─── TableCell (td) ──────────────────────────────────────────────
interface RTableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children?: React.ReactNode
}
export function RTableCell({ children, className, ...props }: RTableCellProps) {
  const mode = React.useContext(TableRenderModeContext)

  if (mode === 'mobile') return null

  return (
    // Desktop: td normal
    <td
      className={cn('px-3 py-3 align-middle text-sm', className)}
      {...props}
    >
      {children}
    </td>
  )
}
