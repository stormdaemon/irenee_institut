"use client";

import { AlignCenter, AlignLeft, AlignRight, Bold, Code2, Heading2, Heading3, Italic, Link, List, ListOrdered, Pilcrow, Quote, Sparkles, Underline } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type RichHtmlEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

const templates = {
  info: `<div style="border-left:4px solid #2563eb;background:#eff6ff;padding:16px 18px;border-radius:8px;margin:18px 0;"><strong>À retenir</strong><p>Ajoutez ici l'idée importante du module.</p></div>`,
  warning: `<div style="border-left:4px solid #e5bd34;background:#fff8dd;padding:16px 18px;border-radius:8px;margin:18px 0;"><strong>Point d'attention</strong><p>Précisez ici une nuance, une objection ou une limite.</p></div>`,
  quote: `<blockquote style="border-left:4px solid #071d49;margin:20px 0;padding:12px 18px;background:#f6f8fc;font-style:italic;">Insérez ici une citation ou un extrait important.</blockquote>`,
  card: `<section style="border:1px solid #dce3ee;border-radius:8px;padding:18px;margin:20px 0;background:#ffffff;"><h3>Bloc pédagogique</h3><p>Présentez ici une notion, un exemple ou une activité.</p></section>`,
};

export function RichHtmlEditor({ value, onChange }: RichHtmlEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [sourceMode, setSourceMode] = useState(false);

  useEffect(() => {
    if (!sourceMode && editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "<p></p>";
    }
  }, [sourceMode, value]);

  function emit() {
    onChange(editorRef.current?.innerHTML || "");
  }

  function run(command: string, argument?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, argument);
    emit();
  }

  function block(tag: string) {
    run("formatBlock", tag);
  }

  function insertHtml(html: string) {
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, html);
    emit();
  }

  function createLink() {
    const href = window.prompt("Lien à ajouter");
    if (!href) return;
    run("createLink", href);
  }

  if (sourceMode) {
    return (
      <div className="rich-editor">
        <div className="rich-toolbar">
          <button type="button" className="toolbar-button active" onClick={() => setSourceMode(false)}><Sparkles size={16} /> Revenir au visuel</button>
        </div>
        <textarea className="input mono-input rich-source" value={value} onChange={event => onChange(event.target.value)} />
      </div>
    );
  }

  return (
    <div className="rich-editor">
      <div className="rich-toolbar" aria-label="Mise en forme du contenu">
        <button type="button" className="toolbar-button" onClick={() => block("p")} title="Paragraphe"><Pilcrow size={16} /></button>
        <button type="button" className="toolbar-button" onClick={() => block("h2")} title="Titre 2"><Heading2 size={16} /></button>
        <button type="button" className="toolbar-button" onClick={() => block("h3")} title="Titre 3"><Heading3 size={16} /></button>
        <span className="toolbar-separator" />
        <button type="button" className="toolbar-button" onClick={() => run("bold")} title="Gras"><Bold size={16} /></button>
        <button type="button" className="toolbar-button" onClick={() => run("italic")} title="Italique"><Italic size={16} /></button>
        <button type="button" className="toolbar-button" onClick={() => run("underline")} title="Souligné"><Underline size={16} /></button>
        <button type="button" className="toolbar-button" onClick={createLink} title="Lien"><Link size={16} /></button>
        <span className="toolbar-separator" />
        <button type="button" className="toolbar-button" onClick={() => run("insertUnorderedList")} title="Liste"><List size={16} /></button>
        <button type="button" className="toolbar-button" onClick={() => run("insertOrderedList")} title="Liste numérotée"><ListOrdered size={16} /></button>
        <button type="button" className="toolbar-button" onClick={() => run("justifyLeft")} title="Aligner à gauche"><AlignLeft size={16} /></button>
        <button type="button" className="toolbar-button" onClick={() => run("justifyCenter")} title="Centrer"><AlignCenter size={16} /></button>
        <button type="button" className="toolbar-button" onClick={() => run("justifyRight")} title="Aligner à droite"><AlignRight size={16} /></button>
        <span className="toolbar-separator" />
        <button type="button" className="toolbar-button text" onClick={() => insertHtml(templates.info)}>Info</button>
        <button type="button" className="toolbar-button text" onClick={() => insertHtml(templates.warning)}>Alerte</button>
        <button type="button" className="toolbar-button" onClick={() => insertHtml(templates.quote)} title="Citation"><Quote size={16} /></button>
        <button type="button" className="toolbar-button text" onClick={() => insertHtml(templates.card)}>Bloc</button>
        <button type="button" className="toolbar-button" onClick={() => setSourceMode(true)} title="Voir le HTML"><Code2 size={16} /></button>
      </div>
      <div
        ref={editorRef}
        className="rich-canvas"
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
      />
    </div>
  );
}
