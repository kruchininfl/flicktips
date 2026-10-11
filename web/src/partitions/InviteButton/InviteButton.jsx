import React from 'react';
import Button from '../../components/Gui/Button';
import {ShareButtons} from 'react-share';

const {FacebookShareButton, VKShareButton} = ShareButtons;
const url = 'https://flicktips.ru';

export default function InviteButton() {
  return (
    <div className="share-buttons">
      <VKShareButton url={url}>
        <Button
          additionClass="invite-btn p-signin__btn p-signin__btn_vk"
          icn="soc_vk"
        >
          Рассказать во Вконтакте
        </Button>
      </VKShareButton>
      <FacebookShareButton url={url}>
        <Button
          additionClass="invite-btn p-signin__btn p-signin__btn_fb"
          icn="soc_fb"
        >
          Рассказать в Facebook
        </Button>
      </FacebookShareButton>
    </div>
  );
}