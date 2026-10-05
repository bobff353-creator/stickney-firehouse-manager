import React from 'react';
// Image rendering only for local policy/box-card fixtures; production uses Next Image.
export default function FixtureImage(props:React.ImgHTMLAttributes<HTMLImageElement>) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} alt={props.alt??''}/>;
}
