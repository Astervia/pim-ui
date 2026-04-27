/**
 * <AddPeerSheet /> — right-edge Sheet for adding a static peer (PEER-02).
 *
 * Spec:
 *   - 03-UI-SPEC §S3 Peers Sheet (480px right-edge, three fields,
 *     Cancel + Add peer footer)
 *   - 03-CONTEXT D-16 (action lives on Peers tab, sheet 480px right)
 *   - 03-CONTEXT D-17 (field labels + placeholders verbatim)
 *   - 03-CONTEXT D-18 (RPC error mapping verbatim)
 *   - 03-CONTEXT D-32 (LimitedModeBanner gates the add flow)
 *
 * Locked-copy strings (DO NOT paraphrase):
 *   - Title:      "Add a static peer"
 *   - Address:    "Peer address"
 *   - Mechanism:  "How to reach it"
 *   - Nickname:   "Nickname (optional)"
 *   - Cancel:     [ Cancel ]
 *   - Submit:     [ Add peer ]   (in-flight: [ Adding… ])
 *   - Limited:    "Reconnect to add peers."
 *
 * Form state pattern: useAddPeer() owns open/submitting at module scope.
 * The form (react-hook-form) is created locally inside this component
 * because react-hook-form's instance is naturally per-render — the
 * AddPeerActionRow does NOT need to read it (it only opens the sheet).
 *
 * Brand rules: zero radius (Sheet primitive enforces), monospace
 * everywhere, no lucide icons, no `!` prefix on values, no exclamation
 * marks in copy.
 */

import { useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDaemonState } from "@/hooks/use-daemon-state";
import {
  useAddPeer,
  useForm,
  ADD_PEER_DEFAULTS,
  type AddPeerFormValues,
} from "@/hooks/use-add-peer";

export function AddPeerSheet() {
  const { open, submitting, closeSheet, buildOnSubmit } = useAddPeer();
  const { snapshot } = useDaemonState();
  const limited = snapshot.state === "running" ? false : true;

  const form = useForm<AddPeerFormValues>({
    defaultValues: ADD_PEER_DEFAULTS,
  });

  // Reset the form whenever the sheet opens so a previous reject's
  // setError() messages and the prior values don't bleed into the next
  // open. (closeSheet via cancel still keeps last edits in case the
  // user re-opens immediately — the next open clears them.)
  useEffect(() => {
    if (open === true) {
      form.reset(ADD_PEER_DEFAULTS);
    }
  }, [open, form]);

  const onSubmit = buildOnSubmit(form);
  const mechanism = form.watch("mechanism");
  const address = form.watch("address");
  const placeholder =
    mechanism === "tcp" ? "192.168.1.5:9000" : "AA:BB:CC:DD:EE:FF";
  const submitDisabled =
    limited === true || address.trim() === "" || submitting === true;

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (v === false) closeSheet();
      }}
    >
      <SheetContent
        side="right"
        className="w-[480px] sm:max-w-[480px] p-6 gap-6"
        aria-label="add a static peer"
      >
        <SheetHeader>
          <SheetTitle>Add a static peer</SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            aria-label="add static peer form"
          >
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Peer address</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={placeholder}
                      spellCheck={false}
                      autoComplete="off"
                      aria-label="peer address"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mechanism"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>How to reach it</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="gap-2"
                      aria-label="mechanism"
                    >
                      <label className="flex items-center gap-2 font-mono text-sm cursor-pointer">
                        <RadioGroupItem value="tcp" id="add-peer-mech-tcp" />
                        <span>tcp (internet / LAN)</span>
                      </label>
                      <label className="flex items-center gap-2 font-mono text-sm cursor-pointer">
                        <RadioGroupItem
                          value="bluetooth"
                          id="add-peer-mech-bt"
                        />
                        <span>bluetooth (nearby pairing)</span>
                      </label>
                      <label className="flex items-center gap-2 font-mono text-sm cursor-pointer">
                        <RadioGroupItem
                          value="wifi_direct"
                          id="add-peer-mech-wfd"
                        />
                        <span>wi-fi direct (nearby pairing)</span>
                      </label>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nickname (optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="gateway-kitchen"
                      maxLength={64}
                      spellCheck={false}
                      autoComplete="off"
                      aria-label="nickname"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {limited === true ? (
              <FormDescription>Reconnect to add peers.</FormDescription>
            ) : null}

            <SheetFooter className="flex flex-row justify-end gap-4 border-t border-border pt-4 mt-2">
              <Button type="button" variant="ghost" onClick={closeSheet}>
                [ Cancel ]
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={submitDisabled}
                aria-busy={submitting === true ? true : undefined}
              >
                {submitting === true ? "[ Adding… ]" : "[ Add peer ]"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
