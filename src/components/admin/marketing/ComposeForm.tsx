"use client";

import { useMemo, useState } from "react";
import { Eye, Info, Send, TriangleAlert } from "lucide-react";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import { Field, Input, Select, SubmitButton, Textarea } from "@/components/admin/ui/Form";

/** What the server sends down about each Brevo template. */
export interface TemplateOption {
  id: number;
  name: string;
  subject: string;
  /** Already run through `previewHtml` on the server, with sample values filled in. */
  preview: string;
  tags: string[];
  hasUnsubscribe: boolean;
  modifiedAt: string;
}

/** One eligible contact, as the picker shows them. No ids: the server matches on the address. */
export interface RecipientOption {
  email: string;
  name: string;
  kind: "registered" | "guest";
  orderCount: number;
}

/**
 * Compose a campaign.
 *
 * The one screen in this feature where a mistake is expensive, so the shape
 * of it is deliberate:
 *
 * - **Nothing here decides who may be emailed.** The list below is already
 *   filtered to people who opted in, and the server re-checks every address
 *   against the live audience and the unsubscribe list before it creates
 *   anything. A stale page cannot send to somebody who unsubscribed while it
 *   was open.
 * - **The preview is a sandboxed iframe.** The HTML is Brevo's own, written
 *   by Danish, but it is rendered with no scripts and no same-origin access
 *   regardless, and the `{{contact.X}}` tags are filled with sample values so
 *   the layout reads like a real email rather than showing template syntax.
 * - **Sending needs the word typed.** A campaign cannot be unsent.
 */
export default function ComposeForm({
  templates,
  recipients,
  defaultTestTo,
  canSend,
  sendAction,
  testAction,
}: {
  templates: TemplateOption[];
  recipients: RecipientOption[];
  defaultTestTo: string;
  canSend: boolean;
  sendAction: (formData: FormData) => void;
  testAction: (formData: FormData) => void;
}) {
  const [templateId, setTemplateId] = useState<number | null>(templates[0]?.id ?? null);
  const [subject, setSubject] = useState(templates[0]?.subject ?? "");
  const [mode, setMode] = useState<"all" | "selected">("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [when, setWhen] = useState<"now" | "schedule">("now");
  const [showPreview, setShowPreview] = useState(false);
  const [confirm, setConfirm] = useState("");

  const template = templates.find((option) => option.id === templateId) ?? null;

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return recipients;
    return recipients.filter(
      (person) =>
        person.email.includes(needle) || person.name.toLowerCase().includes(needle)
    );
  }, [recipients, search]);

  const count = mode === "all" ? recipients.length : picked.size;
  const ready =
    canSend && Boolean(template) && subject.trim().length >= 2 && count > 0;

  function toggle(email: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  // One hidden field carries the selection. Addresses rather than customer
  // ids: the server validates against the real audience either way, so ids
  // would buy nothing and put more in the page.
  const recipientValue = mode === "all" ? "" : [...picked].join(",");

  function pickTemplate(id: number) {
    setTemplateId(id);
    const chosen = templates.find((option) => option.id === id);
    // Only fill the subject in if the admin hasn't written their own.
    if (chosen && (!subject.trim() || templates.some((o) => o.subject === subject))) {
      setSubject(chosen.subject);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {templates.length === 0 && (
        <Card className="border-warn/40">
          <div className="flex gap-3">
            <TriangleAlert className="mt-0.5 shrink-0 text-warn" size={18} />
            <div>
              <h2 className="font-display text-base font-semibold text-heading">
                No templates in Brevo yet
              </h2>
              <p className="mt-1 text-sm text-muted">
                Design one in Brevo with its drag-and-drop editor, make sure it is{" "}
                <strong>active</strong>, and it will appear here. Brevo refuses a campaign built
                on an inactive template, so only active ones are listed.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* The two actions post the same fields, so both forms carry them. The
          hidden mirror keeps them in step without lifting the whole form into
          a single <form> that would make the test button submit a send. */}
      <form action={sendAction} id="send-form">
        <Hidden
          templateId={templateId}
          subject={subject}
          mode={mode}
          recipients={recipientValue}
          when={when}
          confirm={confirm}
        />
      </form>

      <Card>
        <CardHeader
          title="1 · The email"
          subtitle="Templates come from Brevo. The design is edited there, never here."
        />

        <div className="mt-4 space-y-4">
          <Field label="Template" hint={template ? `Last changed ${template.modifiedAt}` : undefined}>
            <Select
              name="templatePicker"
              value={templateId ?? ""}
              onChange={(event) => pickTemplate(Number(event.target.value))}
              disabled={templates.length === 0}
            >
              {templates.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Subject"
            hint="What shows in the inbox. The template's own subject is filled in to start with."
          >
            <Input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={200}
              placeholder="Nieuw op de kaart deze week"
            />
          </Field>

          <Field
            label="Preview text (optional)"
            hint="The grey line some inboxes show after the subject."
          >
            <Textarea name="previewText" rows={2} maxLength={200} form="send-form" />
          </Field>

          {template && (
            <div className="rounded-xl border border-hairline bg-canvas p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-heading">Personalisation this template uses</p>
                <button
                  type="button"
                  onClick={() => setShowPreview((v) => !v)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-ember-600 hover:text-ember-500"
                >
                  <Eye size={15} />
                  {showPreview ? "Hide preview" : "Preview"}
                </button>
              </div>

              {template.tags.length === 0 ? (
                <p className="mt-1 text-xs text-muted">
                  None — everyone gets exactly the same words.
                </p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {template.tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-md bg-panel px-2 py-0.5 text-xs font-medium text-muted"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              )}

              {!template.hasUnsubscribe && (
                <p className="mt-3 flex gap-2 text-xs text-muted">
                  <Info size={14} className="mt-0.5 shrink-0" />
                  <span>
                    This template has no unsubscribe tag of its own, so Brevo appends its own link
                    at the bottom. That is legal and works — adding{" "}
                    <code className="rounded bg-hairline px-1">{"{{ unsubscribe }}"}</code> to the
                    design just lets you put it where you want it.
                  </span>
                </p>
              )}

              {showPreview && (
                <div className="mt-3 overflow-hidden rounded-lg border border-hairline bg-white">
                  {/* Sandboxed with no allow-* at all: no scripts, no forms, no
                      same-origin access. The content is ours, but a preview has
                      no business being able to run anything. */}
                  <iframe
                    title="Email preview"
                    sandbox=""
                    srcDoc={template.preview}
                    className="h-[32rem] w-full"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="2 · Who gets it"
          subtitle="Only people who ticked the marketing box are listed. Anyone who unsubscribed is already gone from this list."
        />

        <div className="mt-4 space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-hairline p-3.5 has-[:checked]:border-ember-600 has-[:checked]:bg-ember-600/5">
            <input
              type="radio"
              name="modePicker"
              checked={mode === "all"}
              onChange={() => setMode("all")}
              className="mt-0.5 accent-ember-600"
            />
            <span>
              <span className="block text-sm font-semibold text-heading">
                Everyone who opted in
              </span>
              <span className="block text-xs text-muted">
                {recipients.length.toLocaleString("en-GB")} subscriber
                {recipients.length === 1 ? "" : "s"} · sent as one campaign to the Kebabish
                subscribers list in Brevo
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-hairline p-3.5 has-[:checked]:border-ember-600 has-[:checked]:bg-ember-600/5">
            <input
              type="radio"
              name="modePicker"
              checked={mode === "selected"}
              onChange={() => setMode("selected")}
              className="mt-0.5 accent-ember-600"
            />
            <span>
              <span className="block text-sm font-semibold text-heading">
                Pick customers
              </span>
              <span className="block text-xs text-muted">
                One person or several. Still goes out as a real campaign, so it carries an
                unsubscribe link and shows up in the statistics.
              </span>
            </span>
          </label>

          {mode === "selected" && (
            <div className="rounded-xl border border-hairline">
              <div className="flex flex-wrap items-center gap-2 border-b border-hairline p-3">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name or email"
                  className="max-w-xs"
                />
                <span className="text-xs text-muted">
                  {picked.size} of {recipients.length} picked
                </span>
                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPicked(new Set(filtered.map((p) => p.email)))}
                    className="rounded-lg border border-hairline px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-canvas"
                  >
                    Select these {filtered.length}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPicked(new Set())}
                    className="rounded-lg border border-hairline px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-canvas"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="p-5 text-center text-sm text-muted">
                    {recipients.length === 0
                      ? "Nobody has opted in to marketing email yet."
                      : "Nobody matches that search."}
                  </p>
                ) : (
                  <ul className="divide-y divide-hairline">
                    {filtered.map((person) => (
                      <li key={person.email}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-canvas">
                          <input
                            type="checkbox"
                            checked={picked.has(person.email)}
                            onChange={() => toggle(person.email)}
                            className="accent-ember-600"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-heading">
                              {person.name || person.email}
                            </span>
                            <span className="block truncate text-xs text-faint">
                              {person.email}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-muted">
                            {person.orderCount} order{person.orderCount === 1 ? "" : "s"}
                          </span>
                          {person.kind === "guest" && (
                            <span className="shrink-0 rounded bg-canvas px-1.5 py-0.5 text-[11px] font-medium text-muted">
                              guest
                            </span>
                          )}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="3 · Test it" subtitle="Sends one copy, to you. Nobody else gets it." />

        {/* Its own form: a test must never be able to trigger a send. */}
        <form action={testAction} className="mt-4 flex flex-wrap items-end gap-3">
          <Hidden
            templateId={templateId}
            subject={subject}
            mode={mode}
            recipients={recipientValue}
            when="now"
          />
          <Field label="Send a test to" className="min-w-[16rem] flex-1">
            <Input name="testTo" type="email" defaultValue={defaultTestTo} required />
          </Field>
          <SubmitButton disabled={!template || subject.trim().length < 2}>Send test</SubmitButton>
        </form>

        <p className="mt-2 text-xs text-faint">
          Brevo needs a campaign to exist before it can test one, so this quietly builds a draft,
          sends the test and removes the draft again — the campaign history stays clean.
        </p>
      </Card>

      <Card>
        <CardHeader title="4 · Send" />

        <div className="mt-4 space-y-4">
          <Field label="When">
            <Select value={when} onChange={(event) => setWhen(event.target.value as "now" | "schedule")}>
              <option value="now">Send now</option>
              <option value="schedule">Schedule it</option>
            </Select>
          </Field>

          {when === "schedule" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date" hint="Amsterdam time">
                <Input name="scheduleDate" type="date" form="send-form" required />
              </Field>
              <Field label="Time">
                <Input name="scheduleTime" type="time" form="send-form" required />
              </Field>
            </div>
          )}

          <div className="rounded-xl border border-danger/30 bg-danger-soft/40 p-4">
            <p className="text-sm font-semibold text-heading">
              This will {when === "schedule" ? "schedule" : "send"} an email to{" "}
              {count.toLocaleString("en-GB")} {count === 1 ? "person" : "people"}.
            </p>
            <p className="mt-1 text-xs text-muted">
              A campaign cannot be unsent. Type <strong>SEND</strong> to confirm.
            </p>
            <input
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="SEND"
              aria-label="Type SEND to confirm"
              className="mt-3 w-40 rounded-lg border border-hairline bg-panel px-3 py-2 text-sm uppercase tracking-wide text-heading focus:border-ember-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            form="send-form"
            disabled={!ready || confirm.trim().toUpperCase() !== "SEND"}
            className="flex items-center gap-2 rounded-lg bg-ember-600 px-4 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={16} />
            {when === "schedule" ? "Schedule campaign" : "Send campaign"}
          </button>

          {!canSend && (
            <p className="text-xs text-danger">
              Sending is switched off until the unsubscribe list can be read — run migration 0032.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

/**
 * The fields the server action reads.
 *
 * The visible controls are React state so the page can show a running
 * recipient count and a preview; these hidden inputs are what actually posts.
 * Two of them (`previewText`, the schedule pair) are rendered as visible
 * inputs with `form="send-form"` instead, which is the same trick the dish
 * editor uses to put sidebar fields in the main form.
 */
function Hidden({
  templateId,
  subject,
  mode,
  recipients,
  when,
  confirm,
}: {
  templateId: number | null;
  subject: string;
  mode: string;
  recipients: string;
  when: string;
  confirm?: string;
}) {
  return (
    <>
      <input type="hidden" name="templateId" value={templateId ?? ""} />
      <input type="hidden" name="subject" value={subject} />
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="recipients" value={recipients} />
      <input type="hidden" name="when" value={when} />
      {confirm !== undefined && <input type="hidden" name="confirm" value={confirm} />}
    </>
  );
}
