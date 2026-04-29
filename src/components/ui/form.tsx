/**
 * <Form /> — shadcn Form primitive (new-york), react-hook-form integration.
 *
 * Spec: .planning/phases/03-configuration-peer-management/03-UI-SPEC.md
 *        §Registry Safety §Brand overrides → form
 *
 * Brand overrides from upstream shadcn new-york:
 *   - The hook/context scaffolding (FormFieldContext, FormItemContext,
 *     useFormField, FormField, Form, FormControl) is the react-hook-form
 *     integration and is preserved verbatim from upstream.
 *   - Wrapper typography is brand-overridden:
 *       - FormItem: flex flex-col gap-2 (replaces grid gap-2)
 *       - FormLabel: font-mono text-xs uppercase tracking-widest text-muted-foreground
 *         (label role per 03-UI-SPEC §Token provenance)
 *       - FormDescription: font-mono text-sm text-muted-foreground leading-[1.6]
 *         (body role in muted)
 *       - FormMessage: font-mono text-sm text-destructive (body + destructive)
 *   - data-[error=true]:text-destructive on FormLabel preserved (matches
 *     upstream + brand uses text-destructive token).
 */

import * as React from "react"
import type { Label as LabelPrimitive } from "radix-ui"
import { Slot } from "radix-ui"
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

const Form = FormProvider

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue,
)

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState } = useFormContext()
  const formState = useFormState({ name: fieldContext.name })
  const fieldState = getFieldState(fieldContext.name, formState)

  if (fieldContext === undefined || fieldContext === null) {
    throw new Error("useFormField should be used within FormField")
  }

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

type FormItemContextValue = {
  id: string
}

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue,
)

function FormItem({ className, ...props }: React.ComponentProps<"div">) {
  const id = React.useId()

  return (
    <FormItemContext.Provider value={{ id }}>
      <div
        data-slot="form-item"
        className={cn("flex flex-col gap-2", className)}
        {...props}
      />
    </FormItemContext.Provider>
  )
}

function hasError(error: unknown): boolean {
  return error !== undefined && error !== null
}

function FormLabel({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  const { error, formItemId } = useFormField()

  return (
    <Label
      data-slot="form-label"
      data-error={hasError(error)}
      className={cn(
        // text-foreground (was muted-foreground) so labels are
        // unambiguously legible — labels ARE the primary scannable
        // text of a form. Tracking trimmed from widest → wider so the
        // sentence-case label reads as a real label rather than a
        // chrome heading.
        "font-mono text-xs uppercase tracking-wider text-foreground font-semibold",
        "data-[error=true]:text-destructive",
        className,
      )}
      htmlFor={formItemId}
      {...props}
    />
  )
}

function FormControl({ ...props }: React.ComponentProps<typeof Slot.Root>) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()

  return (
    <Slot.Root
      data-slot="form-control"
      id={formItemId}
      aria-describedby={
        hasError(error) === false
          ? `${formDescriptionId}`
          : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={hasError(error)}
      {...props}
    />
  )
}

function FormDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { formDescriptionId } = useFormField()

  return (
    <p
      data-slot="form-description"
      id={formDescriptionId}
      className={cn(
        "font-code text-xs text-text-secondary leading-[1.55]",
        className,
      )}
      {...props}
    />
  )
}

function FormMessage({ className, ...props }: React.ComponentProps<"p">) {
  const { error, formMessageId } = useFormField()
  const body = hasError(error)
    ? String(error?.message ?? "")
    : props.children

  if (body === undefined || body === null || body === "") {
    return null
  }

  return (
    <p
      data-slot="form-message"
      id={formMessageId}
      className={cn("font-mono text-sm text-destructive", className)}
      {...props}
    >
      {body}
    </p>
  )
}

export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
}
