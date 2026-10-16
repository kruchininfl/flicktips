import React from 'react';
import PropTypes from 'prop-types';

// Inline icons for the invite popup: the icon font (public/icons, an IcoMoon export) has no Telegram,
// WhatsApp or copy glyphs. They take the text color and 1em size, like font icons.
const paths = {
  telegram: [
    'M21.9 4.3l-3.2 15.3c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.3c.4-.4-.1-.6-.6-.2L6.2' +
    ' 13.2l-4.9-1.5c-1-.3-1.1-1.1.2-1.6L20.6 2.8c.9-.3 1.6.2 1.3 1.5z'
  ],
  whatsapp: [
    'M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-2.9-.4-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2' +
    ' 8.2 0 1 1 12 20.2z',
    'M16.5 14.3l-1.7-.8c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3' +
    ' 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.8 2.8 4.5 4 1.7.7' +
    ' 2.3.8 3.2.6.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.6-.3z'
  ],
  copy: [
    'M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0' +
    ' 16H8V7h11v14z'
  ],
  check: ['M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z']
};

export default function ShareIcon({name}) {
  return (
    <svg className="svg-icn" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
      {paths[name].map((d, key) => <path key={key} d={d} />)}
    </svg>
  );
}

ShareIcon.propTypes = {
  name: PropTypes.oneOf(Object.keys(paths)).isRequired
};