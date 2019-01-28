export function pluralGender(gender, phrases) {
  if (gender === 'male') {
    return phrases[0];
  } else if (gender === 'female') {
    return phrases[1];
  }

  return phrases[2];
}

export function getTextByVoteId(id) {
  const icons = ['Не понравился', 'Средне', 'Понравился'];

  return icons[id];
}

export function getStringByVoteId(id) {
  const icons = ['dislike', 'neutral', 'like'];

  return icons[id];
}

export function getVoteIconClassById(id, filled = false) {
  const icons = ['icn_heart-dislike', 'icn_heart-neutral', 'icn_heart-like'];

  return icons[id] + (filled ? '-fill' : '');
}