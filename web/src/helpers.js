export function pluralGender(gender, phrases) {
  if (gender === 'male') {
    return phrases[0];
  } else if (gender === 'female') {
    return phrases[1];
  }

  return phrases[2];
}

export function getTextByVoteId(id) {
  const icons = ['Не понравился', 'Средне', 'Понравился', 'Супер'];

  return icons[id];
}

export function getStringByVoteId(id) {
  const icons = ['dislike', 'neutral', 'like', 'super'];

  return icons[id];
}

export function getVoteIconClassById(id, filled = false) {
  const icons = ['dislike', 'neutral', 'like', 'super'];

  return `vote-icn vote-icn_${icons[id]} ${filled ? 'm-active' : ''}`;
}