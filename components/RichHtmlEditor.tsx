"use client";

import DOMPurify from "dompurify";
import { AlignCenter, AlignLeft, AlignRight, Bold, Code2, Heading2, Heading3, Italic, Link, List, ListOrdered, Pilcrow, Quote, Sparkles, Underline } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { sanitizeCourseClassAttribute, sanitizeCourseStyleAttribute } from "../lib/course-html-style";

type RichHtmlEditorProps = {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export const richEditorTemplates = {
  info: `<div class="course-callout course-callout-info"><strong>À retenir</strong><p>Ajoutez ici l'idée importante du module.</p></div>`,
  warning: `<div class="course-callout course-callout-warning"><strong>Point d'attention</strong><p>Précisez ici une nuance, une objection ou une limite.</p></div>`,
  quote: `<blockquote class="course-quote">Insérez ici une citation ou un extrait important.</blockquote>`,
  card: `<section class="course-block"><h3>Bloc pédagogique</h3><p>Présentez ici une notion, un exemple ou une activité.</p></section>`,
};

function sanitizeForEditing(html: string) {
  if (typeof window === "undefined" || typeof DOMPurify.sanitize !== "function") return html;
  const template = document.createElement("template");
  template.innerHTML = DOMPurify.sanitize(html, {
    FORBID_TAGS: ["audio", "script", "source", "style", "iframe", "object", "embed", "form", "track", "video"],
  });
  template.content.querySelectorAll<HTMLElement>("[style]").forEach(element => {
    const safeStyle = sanitizeCourseStyleAttribute(element.getAttribute("style") || "");
    if (safeStyle) element.setAttribute("style", safeStyle);
    else element.removeAttribute("style");
  });
  template.content.querySelectorAll<HTMLElement>("[class]").forEach(element => {
    const safeClass = sanitizeCourseClassAttribute(element.getAttribute("class") || "");
    if (safeClass) element.setAttribute("class", safeClass);
    else element.removeAttribute("class");
  });
  template.content.querySelectorAll<HTMLImageElement>("img").forEach(image => {
    image.alt = image.alt.trim() || image.title.trim() || "Illustration du cours";
    image.loading = "lazy";
  });
  template.content.querySelectorAll<HTMLTableElement>("table").forEach(table => {
    table.tabIndex = 0;
    table.setAttribute("aria-label", table.getAttribute("aria-label") || "Tableau du cours — défilement horizontal");
  });
  return template.innerHTML;
}

function safeLink(value: string) {
  const candidate = value.trim();
  if (!candidate || candidate.length > 2_048 || /[\u0000-\u001f\u007f\\]/.test(candidate)) return "";
  try {
    const decoded = decodeURIComponent(candidate);
    if (/[\u0000-\u001f\u007f\\]/.test(decoded) || decoded.startsWith("//")) return "";
  } catch {
    return "";
  }
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;
  try {
    const url = new URL(candidate);
    return ["https:", "mailto:", "tel:"].includes(url.protocol) && !url.username && !url.password ? candidate : "";
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
  const containsTable = /<table\b/i.test(value);
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
      <div className="rich-editor" data-sticky-boundary="rich-editor">
        <div className="rich-toolbar" data-sticky-toolbar="true" role="toolbar" aria-label={`Mise en forme de ${label}`} aria-controls={`${editorId}-source`}>
          <div className="rich-toolbar-group" role="group" aria-label="Mode d’édition">
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
    <div className="rich-editor" data-sticky-boundary="rich-editor">
      <span className="rich-toolbar-mobile-hint">Outils de mise en forme · faites glisser →</span>
      <div className="rich-toolbar" data-sticky-toolbar="true" role="toolbar" aria-label={`Mise en forme de ${label}`} aria-controls={editorId}>
        <div className="rich-toolbar-group" role="group" aria-label="Structure du texte">
          <button type="button" className="toolbar-button" aria-label="Paragraphe" disabled={disabled} onPointerDown={preserveSelection} onClick={() => block("p")} title="Paragraphe"><Pilcrow size={16} aria-hidden="true" /></button>
          <button type="button" className="toolbar-button" aria-label="Titre de niveau 2" disabled={disabled} onPointerDown={preserveSelection} onClick={() => block("h2")} title="Titre 2"><Heading2 size={16} aria-hidden="true" /></button>
          <button type="button" className="toolbar-button" aria-label="Titre de niveau 3" disabled={disabled} onPointerDown={preserveSelection} onClick={() => block("h3")} title="Titre 3"><Heading3 size={16} aria-hidden="true" /></button>
        </div>
        <div className="rich-toolbar-group" role="group" aria-label="Mise en forme">
          <button type="button" className="toolbar-button" aria-label="Gras" aria-keyshortcuts="Control+B Meta+B" disabled={disabled} onPointerDown={preserveSelection} onClick={() => run("bold")} title="Gras"><Bold size={16} aria-hidden="true" /></button>
          <button type="button" className="toolbar-button" aria-label="Italique" aria-keyshortcuts="Control+I Meta+I" disabled={disabled} onPointerDown={preserveSelection} onClick={() => run("italic")} title="Italique"><Italic size={16} aria-hidden="true" /></button>
          <button type="button" className="toolbar-button" aria-label="Souligné" aria-keyshortcuts="Control+U Meta+U" disabled={disabled} onPointerDown={preserveSelection} onClick={() => run("underline")} title="Souligné"><Underline size={16} aria-hidden="true" /></button>
          <button type="button" className="toolbar-button" aria-label="Ajouter un lien" disabled={disabled} onPointerDown={preserveSelection} onClick={createLink} title="Lien"><Link size={16} aria-hidden="true" /></button>
        </div>
        <div className="rich-toolbar-group" role="group" aria-label="Listes et alignement">
          <button type="button" className="toolbar-button" aria-label="Liste à puces" disabled={disabled} onPointerDown={preserveSelection} onClick={() => run("insertUnorderedList")} title="Liste"><List size={16} aria-hidden="true" /></button>
          <button type="button" className="toolbar-button" aria-label="Liste numérotée" disabled={disabled} onPointerDown={preserveSelection} onClick={() => run("insertOrderedList")} title="Liste numérotée"><ListOrdered size={16} aria-hidden="true" /></button>
          <button type="button" className="toolbar-button" aria-label="Aligner à gauche" disabled={disabled} onPointerDown={preserveSelection} onClick={() => run("justifyLeft")} title="Aligner à gauche"><AlignLeft size={16} aria-hidden="true" /></button>
          <button type="button" className="toolbar-button" aria-label="Centrer" disabled={disabled} onPointerDown={preserveSelection} onClick={() => run("justifyCenter")} title="Centrer"><AlignCenter size={16} aria-hidden="true" /></button>
          <button type="button" className="toolbar-button" aria-label="Aligner à droite" disabled={disabled} onPointerDown={preserveSelection} onClick={() => run("justifyRight")} title="Aligner à droite"><AlignRight size={16} aria-hidden="true" /></button>
        </div>
        <div className="rich-toolbar-group" role="group" aria-label="Blocs pédagogiques">
          <button type="button" className="toolbar-button text" aria-label="Insérer un encadré d'information" disabled={disabled} onPointerDown={preserveSelection} onClick={() => insertHtml(richEditorTemplates.info)}>Info</button>
          <button type="button" className="toolbar-button text" aria-label="Insérer un encadré d'alerte" disabled={disabled} onPointerDown={preserveSelection} onClick={() => insertHtml(richEditorTemplates.warning)}>Alerte</button>
          <button type="button" className="toolbar-button" aria-label="Insérer une citation" disabled={disabled} onPointerDown={preserveSelection} onClick={() => insertHtml(richEditorTemplates.quote)} title="Citation"><Quote size={16} aria-hidden="true" /></button>
          <button type="button" className="toolbar-button text" aria-label="Insérer un bloc pédagogique" disabled={disabled} onPointerDown={preserveSelection} onClick={() => insertHtml(richEditorTemplates.card)}>Bloc</button>
        </div>
        <div className="rich-toolbar-group" role="group" aria-label="Outils du contenu">
          <button type="button" className="toolbar-button" aria-label="Modifier le code HTML" aria-pressed="false" disabled={disabled} onPointerDown={preserveSelection} onClick={() => setSourceMode(true)} title="Voir le HTML"><Code2 size={16} aria-hidden="true" /></button>
        </div>
      </div>
      {containsTable && <p className="rich-table-hint" id={`${editorId}-table-help`}>Tableau · faites glisser horizontalement ; la première colonne reste visible.</p>}
      <div
        id={editorId}
        ref={editorRef}
        className="rich-canvas"
        role="textbox"
        aria-label={label}
        aria-describedby={containsTable ? `${editorId}-table-help` : undefined}
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
