import React, {Component} from 'react';
import Helmet from 'react-helmet';

class AboutPage extends Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    window.scrollTo(0, 0);
  }

  render() {
    return (
      <div className="static-page">
        <Helmet>
          <title>О Проекте — FlickTips</title>
        </Helmet>
        <p>После окончания любимого сериала или просмотра захватывающего фильма хочется найти что-то не менее стоящее.
          Часто поиски затягиваются настолько, что желание что-то смотреть пропадает вовсе. Знакомо?</p>
        <p>Как вы выбираете фильмы или сериалы? Тыкаете на предложенные сайтом варианты? Просматриваете новинки?
          Или пересматриваете старые добрые ленты, которые точно не разочаруют? А сколько раз выбранный фильм оказывался
          скучным и неподходящим, и как мало тех, которые западают в душу.</p>
        <p>Хорошая новость! Теперь находить такие фильмы намного проще. Благодаря нашему сервису кино и сериалы можно
          выбирать не на основе обложки и краткого описания или рецензий неизвестных вам критиков, а по оценкам друзей.</p>
        <p>После авторизации через соцсеть вы видите реакции друзей на разные фильмы. Они могут быть негативными,
          нейтральными и положительными. Заинтересовал какой-то фильм? Добавьте в закладки, чтобы посмотреть позже.
          А затем оцените.</p>
        <p>Когда вы ставите фильму оценку, друзья тоже видят ваши впечатления. Соответственно, зайдя на страницу близкого
          друга или интересующего вас человека, есть возможность сравнить вкусы или пересмотреть понравившиеся,
          и не только, фильмы. </p>
        <p>Приложение имеет несколько преимуществ. Первое – значительная экономия времени на поиск сериалов и фильмов.
          Второе – большая вероятность попадания в десятку: фильмы, понравившиеся вашим близким, понравятся и вам.
          И третье – это прекрасный повод для общения и появления общих интересов. Ведь вы знаете, что нравится друзьям!</p>
      </div>
    );
  }
}

export default AboutPage;