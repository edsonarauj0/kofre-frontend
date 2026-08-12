import * as React from "react"

import { Input } from "@/components/ui/input"
import {
  formatarValorParaInput,
  mascararValorMonetarioDigitado,
} from "@/shared/lib/formatadores"

type CurrencyInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "onChange"
> & {
  value?: string | number | null
  onValueChange: (value: string) => void
  allowNegative?: boolean
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onValueChange, allowNegative = false, ...props }, ref) => {
    const valorExibido = React.useMemo(
      () => formatarValorParaInput(value),
      [value]
    )

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        value={valorExibido}
        onChange={(event) => {
          onValueChange(
            mascararValorMonetarioDigitado(event.target.value, {
              allowNegative,
            })
          )
        }}
      />
    )
  }
)

CurrencyInput.displayName = "CurrencyInput"

export { CurrencyInput }
