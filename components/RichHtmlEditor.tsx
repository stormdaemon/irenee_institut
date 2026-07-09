"use client";

import DOMPurify from "dompurify";
import { AlignCenter, AlignLeft, AlignRight, Bold, Code2, Heading2, Heading3, Italic, Link, List, ListOrdered, Pilcrow, Quote, Sparkles, Underline } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

type RichHtmlEditorProps = {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

const templates = {
  info: `<div style="border-left:4px solid #2563eb;background:#eff6ff;padding:16px 18px;border-radius:8px;margin:18px 0;"><strong>À retenir</strong><p>Ajoutez ici l'idée importante du module.</p></div>`,
  warning: `<div style="border-left:4px solid #e5bd34;background:#fff8dd;padding:16px 18px;border-radius:8px;margin:18px 0;"><strong>Point d'attention</strong><p>Précisez ici une nuance, une objection ou une limite.</p></div>`,
  quote: `<blockquote style="border-left:4px solid #071d49;margin:20px 0;padding:12px 18px;background:#f6f8fc;font-style:italic;">Insérez ici une citation ou un extrait important.</blockquote>`,
  card: `<section style="border:1px solid #dce3ee;border-radius:8px;padding:18px;margin:20px 0;background:#ffffff;"><h3>Bloc pédagogique</h3><p>Présentez ici une notion, un exemple ou une activité.</p></section>`,
};

function sanitizeForEditing(html: string) {
  if (typeof window === "undefined" || typeof DOMPurify.sanitize !== "function") return html;
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
  });
}

function safeLink(value: string) {
  const candidate = value.trim();
  if (/[\u0000-\u001f\u007f\\]/.test(candidate)) return "";
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;
  try {
    const url = new URL(candidate);
    return ["https:", "mailto:", "tel:"].includes(url.protocol) ? candidate : "";
  } catch {
    return "";
  }
}

export function RichHtmlEditor({
  id,
  label = "Contenu du module",
  value,
  onChange,
  disabled = false,
}: RichHtmlEditorProps) {
  const generatedId = useId();
  const editorId = id || `rich-editor-${generatedId.replace(/:/g, "")}`;
  const editorRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<Range | null>(null);
  const [sourceMode, setSourceMode] = useState(false);

  useEffect(() => {
    if (!sourceMode && editorRef.current) {
      const sanitizedValue = sanitizeForEditing(value);
      if (editorRef.current.innerHTML !== sanitizedValue) {
        editorRef.current.innerHTML = sanitizedValue;
        selectionRef.current = null;
      }
      if (sanitizedValue !== value) onChange(sanitizedValue);
    }
  }, [sourceMode, value]);

  function emit() {
    if (disabled) return;
    const editor = editorRef.current;
    const rawHtml = editor?.innerHTML || "";
    const sanitizedHtml = sanitizeForEditing(rawHtml);
    if (editor && rawHtml !== sanitizedHtml) {
      editor.innerHTML = sanitizedHtml;
      selectionRef.current = null;
    }
    onChange(sanitizedHtml);
  }

  function rememberSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) selectionRef.current = range.cloneRange();
  }

  function restoreSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    const range = selectionRef.current;
    if (!editor || !selection || !range || !editor.contains(range.commonAncestorContainer)) return;
    try {
      selection.removeAllRanges();
      selection.addRange(range);
    } catch {
      selectionRef.current = null;
    }
  }

  function run(command: string, argument?: string) {
    if (disabled) return;
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand(command, false, argument);
    rememberSelection();
    emit();
  }

  function block(tag: string) {
    run("formatBlock", tag);
  }

  function insertHtml(html: string) {
    if (disabled) return;
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand("insertHTML", false, html);
    rememberSelection();
    emit();
  }

  function createLink() {
    if (disabled) return;
    const href = window.prompt("Lien à ajouter");
    if (!href) return;
    const safeHref = safeLink(href);
    if (!safeHref) {
      window.alert("Utilisez un lien HTTPS, une adresse interne, un e-mail ou un numéro de téléphone.");
      return;
    }
    run("createLink", safeHref);
  }

  function preserveSelection(event: React.PointerEvent<HTMLButtonElement>) {
    if (disabled) return;
    rememberSelection();
    event.preventDefault();
  }

  if (sourceMode) {
    return (
      <div className="rich-editor">
        <div className="rich-toolbar" role="toolbar" aria-label={`Mise en forme de ${label}`} aria-controls={`${editorId}-source`}>
          <button
            type="button"
            className="toolbar-button active"
            aria-label="Revenir à l'éditeur visuel"
            aria-pressed="true"
            disabled={disabled}
            onClick={() => setSourceMode(false)}
          >
            <Sparkles size={16} aria-hidden="true" /> Revenir au visuel
          </button>
        </div>
        <textarea
          id={`${editorId}-source`}
          className="input mono-input rich-source"
          aria-label={`${label} — code HTML`}
          value={value}
          disabled={disabled}
          onChange={event => onChange(event.target.value)}
        />
      </div>
    );
  }

  return (
    <div className="rich-editor">
      <div className="rich-toolbar" role="toolbar" aria-label={`Mise en forme de ${label}`} aria-controls={editorId}>
        <button type="button" className="toolbar-button" aria-label="Paragraphe" disabled={disabled} onPointerDown={preserveSelection} onClick={() => block("p")} title="Paragraphe"><Pilcrow size={16} aria-hidden="true" /></button>
        <button type="button" className="toolbar-button" aria-label="Titre de niveau 2" disabled={disabled} onPointerDown={preserveSelection} onClick={() => block("h2")} title="Titre 2"><Heading2 size={16} aria-hidden="true" /></button>
        <button type="button" className="toolbar-button" aria-label="Titre de niveau 3" disabled={disabled} onPointerDown={preserveSelection} onClick={() => block("h3")} title="Titre 3"><Heading3 size={16} aria-hidden="true" /></button>
        <span className="toolbar-separator" role="separator" aria-orientation="vertical" />
        <button type="button" className="toolbar-button" aria-label="Gras" aria-keyshortcuts="Control+B Meta+B" disabled={disabled} onPointerDown={preserveSelection} onClick={() => run("bold")} title="Gras"><Bold size={16} aria-hidden="true" /></button>
        <button type="button" className="toolbar-button" aria-label="Italique" aria-keyshortcuts="Control+I Meta+I" disabled={disabled} onPointerDown={preserveSelection} onClick={() => run("italic")} title="Italique"><Italic size={16} aria-hidden="true" /></button>
        <button type="button" className="toolbar-button" aria-label="Souligné" aria-keyshortcuts="Control+U Meta+U" disabled={disabled} onPointerDown={preserveSelection} onClick={() => run("underline")} title="Souligné"><Underline size={16} aria-hidden="true" /></button>
        <button type="button" className="toolbar-button" aria-label="Ajouter un lien" disabled={disabled} onPointerDown={preserveSelection} onClick={createLink} title="Lien"><Link size={16} aria-hidden="true" /></button>
        <span className="toolbar-separator" role="separator" aria-orientation="vertical" />
        <button type="button" className="toolbar-button" aria-label="Liste à puces" disabled={disabled} onPointerDown={preserveSelection} onClick={() => run("insertUnorderedList")} title="Liste"><List size={16} aria-hidden="true" /></button>
        <button type="button" className="toolbar-button" aria-label="Liste numérotée" disabled={disabled} onPointerDown={preserveSelection} onClick={() => run("insertOrderedList")} title="Liste numérotée"><ListOrdered size={16} aria-hidden="true" /></button>
        <button type="button" className="toolbar-button" aria-label="Aligner à gauche" disabled={disabled} onPointerDown={preserveSelection} onClick={() => run("justifyLeft")} title="Aligner à gauche"><AlignLeft size={16} aria-hidden="true" /></button>
        <button type="button" className="toolbar-button" aria-label="Centrer" disabled={disabled} onPointerDown={preserveSelection} onClick={() => run("justifyCenter")} title="Centrer"><AlignCenter size={16} aria-hidden="true" /></button>
        <button type="button" className="toolbar-button" aria-label="Aligner à droite" disabled={disabled} onPointerDown={preserveSelection} onClick={() => run("justifyRight")} title="Aligner à droite"><AlignRight size={16} aria-hidden="true" /></button>
        <span className="toolbar-separator" role="separator" aria-orientation="vertical" />
        <button type="button" className="toolbar-button text" aria-label="Insérer un encadré d'information" disabled={disabled} onPointerDown={preserveSelection} onClick={() => insertHtml(templates.info)}>Info</button>
        <button type="button" className="toolbar-button text" aria-label="Insérer un encadré d'alerte" disabled={disabled} onPointerDown={preserveSelection} onClick={() => insertHtml(templates.warning)}>Alerte</button>
        <button type="button" className="toolbar-button" aria-label="Insérer une citation" disabled={disabled} onPointerDown={preserveSelection} onClick={() => insertHtml(templates.quote)} title="Citation"><Quote size={16} aria-hidden="true" /></button>
        <button type="button" className="toolbar-button text" aria-label="Insérer un bloc pédagogique" disabled={disabled} onPointerDown={preserveSelection} onClick={() => insertHtml(templates.card)}>Bloc</button>
        <button type="button" className="toolbar-button" aria-label="Modifier le code HTML" aria-pressed="false" disabled={disabled} onPointerDown={preserveSelection} onClick={() => setSourceMode(true)} title="Voir le HTML"><Code2 size={16} aria-hidden="true" /></button>
      </div>
      <div
        id={editorId}
        ref={editorRef}
        className="rich-canvas"
        role="textbox"
        aria-label={label}
        aria-multiline="true"
        aria-readonly={disabled}
        data-placeholder="Écrivez le contenu du module ici..."
        contentEditable={!disabled}
        suppressContentEditableWarning
        tabIndex={disabled ? -1 : 0}
        onInput={() => {
          rememberSelection();
          emit();
        }}
        onBlur={() => {
          rememberSelection();
          emit();
        }}
        onKeyUp={rememberSelection}
        onPointerUp={rememberSelection}
      />
    </div>
  );
}
