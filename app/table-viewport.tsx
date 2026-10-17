import type {ReactNode} from 'react';

/** Keep every comparison column and action available to touch and keyboard users. */
export default function TableViewport({label,className='',children}:{label:string;className?:string;children:ReactNode}) {
  return <><p className="table-navigation-hint">All columns remain available. Scroll the table horizontally if needed; focus it to use the arrow keys.</p><div className={`${className} accessible-table-viewport`} role="region" aria-label={label} tabIndex={0}>{children}</div></>;
}
