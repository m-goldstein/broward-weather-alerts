export default function CoastalArt() {
  return <svg className="coastal-art" viewBox="0 0 420 195" aria-hidden="true">
    <defs><linearGradient id="water" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#8eb4a1"/><stop offset="1" stopColor="#bfd4bd"/></linearGradient><linearGradient id="land" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ecedc9"/><stop offset="1" stopColor="#d0d7aa"/></linearGradient></defs>
    <circle cx="326" cy="54" r="27" fill="#f4ecc0"/><circle cx="326" cy="54" r="40" fill="none" stroke="#d3dbc0" strokeWidth="1"/>
    <path d="M-10 106C75 82 82 109 159 81S290 102 436 72V204H-10Z" fill="#cee0cb"/>
    <path d="M-10 126C52 99 105 132 188 108S312 116 440 93V204H-10Z" fill="url(#water)"/>
    <path d="M90 205c14-49 97-61 136-88s52-38 117-40c-27 15-35 25-27 33s-6 22-59 35-86 26-84 60" fill="url(#land)"/>
    <path d="M90 205c14-49 97-61 136-88s52-38 117-40" fill="none" stroke="#eef0d1" strokeWidth="4"/>
    <path d="M121 206c-3-24 37-49 88-62s87-37 91-47" fill="none" stroke="#b5c29b" strokeWidth="1"/>
    <g fill="none" stroke="#e8f0df" strokeWidth="1" opacity=".65"><path d="M-10 157q44-24 94-2m-90 23q42-24 87-2M345 116q46 6 82-8m-77 24q40 5 77-8m-123 35q62 13 119-3m-144 26q75 16 144-1"/><path d="M9 128q32-14 57-4M344 158q37 6 57-3"/></g>
    <g transform="translate(253 111)"><path d="M0 33Q8 4 1-16" fill="none" stroke="#607c55" strokeWidth="4"/><path d="M1-13q-20-17-32 1 20-7 30 4M1-13q-2-24-19-19 15 6 18 19M1-13q14-22 30-10-21 0-28 13M1-13q26-2 27 18-9-16-26-14" fill="#557b54"/></g>
    <g transform="translate(290 124) scale(.65)"><path d="M0 33Q8 4 1-16" fill="none" stroke="#607c55" strokeWidth="4"/><path d="M1-13q-20-17-32 1 20-7 30 4M1-13q-2-24-19-19 15 6 18 19M1-13q14-22 30-10-21 0-28 13M1-13q26-2 27 18-9-16-26-14" fill="#557b54"/></g>
    <g stroke="#718b73" strokeWidth="1.5" fill="none"><path d="M157 48q6-6 12 0 6-6 12 0M202 28q4-4 8 0 4-4 8 0"/></g>
    <path d="M34 61h28m-14-14v28" stroke="#9ab69c" strokeWidth="1"/><circle cx="363" cy="168" r="4" fill="#d8e4c6"/>
  </svg>;
}
