'use client';

import { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';

function TB({ onClick, active, children }: { onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 text-sm font-medium ${active ? 'bg-brand-100 text-brand-700' : 'text-slate-600 hover:bg-slate-200'}`}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({ name, initialHtml }: { name: string; initialHtml: string }) {
  const [html, setHtml] = useState(initialHtml);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false }),
    ],
    content: initialHtml || '',
    editorProps: {
      attributes: {
        class: 'prose max-w-none min-h-[160px] rounded-b-md border border-slate-300 px-3 py-2 text-sm focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => setHtml(editor.getHTML()),
  });

  if (!editor) return null;

  function setLink() {
    const url = window.prompt('Link URL (leave blank to remove)');
    if (url === null) return;
    if (url === '') {
      editor!.chain().focus().unsetLink().run();
      return;
    }
    editor!.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1 rounded-t-md border border-b-0 border-slate-300 bg-slate-100 p-1">
        <TB active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>Bold</TB>
        <TB active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>Italic</TB>
        <TB active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</TB>
        <TB active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</TB>
        <TB active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</TB>
        <TB active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</TB>
        <TB active={editor.isActive('link')} onClick={setLink}>Link</TB>
        <TB onClick={() => editor.chain().focus().undo().run()}>Undo</TB>
        <TB onClick={() => editor.chain().focus().redo().run()}>Redo</TB>
      </div>
      <EditorContent editor={editor} />
      <input type="hidden" name={name} value={html} />
    </div>
  );
}
