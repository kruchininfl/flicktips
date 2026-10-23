'use client';

import { useState } from 'react';

import { Button } from '@/components/gui/Button';
import { Icon } from '@/components/gui/Icon';
import { Modal } from '@/components/gui/Modal';
import { cx } from '@/lib/cx';

// The «Трейлер» button and its popup with the YouTube player and prev/next arrows
// (web/src/components/MoviePage/MovieTrailer). `trailers` are YouTube video ids.
export function MovieTrailer({ trailers }: { trailers: string[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [index, setIndex] = useState(0);

  if (!trailers.length) return null;

  const close = () => setIsOpen(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)} size="big" color="blue" variant="border" className="movie__trailer-btn">
        Трейлер
      </Button>

      <Modal isOpen={isOpen} onRequestClose={close} className="p-trailer" contentLabel="Movie trailer">
        <Icon name="cross" onClick={close} className="ReactModal__Close m-white" />

        <div className="p-trailer__content">
          <div
            onClick={() => setIndex((value) => value - 1)}
            className={cx('p-trailer__content-control m-left', index <= 0 && 'm-disabled')}
          >
            <Icon name="arrow-left" />
          </div>

          <div className="p-trailer__content-video">
            <div className="p-trailer__content-video-inn">
              <div>
                <iframe
                  key={trailers[index]}
                  src={`https://www.youtube.com/embed/${encodeURIComponent(trailers[index]!)}?autoplay=1&showinfo=0&rel=0`}
                  title="Трейлер"
                  style={{ border: 0 }}
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                />
              </div>
            </div>
          </div>

          <div
            onClick={() => setIndex((value) => value + 1)}
            className={cx('p-trailer__content-control m-right', index >= trailers.length - 1 && 'm-disabled')}
          >
            <Icon name="arrow-right" />
          </div>
        </div>
      </Modal>
    </>
  );
}
