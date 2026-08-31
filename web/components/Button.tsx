import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
}

const BASE_CLASSES =
  'rounded-[15px] px-5 py-2.5 font-semibold shadow-[3px_3px_15px_rgba(33,33,33,0.66)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none'

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-orca-verde-agua text-white hover:brightness-95',
  secondary: 'bg-white text-orca-verde-agua border-2 border-orca-verde-agua hover:bg-[#44B494]/10',
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return <button className={`${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${className}`.trim()} {...props} />
}
