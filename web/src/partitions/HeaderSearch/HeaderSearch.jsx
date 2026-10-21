import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import MoviePreview from 'partitions/MoviePreview';
import {searchRequest, searchRequestClear} from 'redux/actions/searchActions';
import Spinner from 'components/Gui/Spinner';
import {closeSearch, openSearch} from 'redux/actions/appActions';

import './HeaderSearch.scss';

const propTypes = {
  dispatch: PropTypes.func.isRequired,
  pending : PropTypes.bool.isRequired,
  response: PropTypes.any,
  opened  : PropTypes.bool,
  query   : PropTypes.string
};

const defaultProps = {
  opened: false,
  query : ''
};

const minQueryLength = 2;

let timeoutRequest;

class HeaderSearch extends Component {
  constructor(props) {
    super(props);

    this.handleQueryChange = this.handleQueryChange.bind(this);
    this.handleOpenSearch = this.handleOpenSearch.bind(this);
    this.handleCloseSearch = this.handleCloseSearch.bind(this);
    this.handleCloseSearchForce = this.handleCloseSearchForce.bind(this);

    this.state = {
      query  : this.props.query,
      pending: this.props.pending
    };
  }

  componentDidUpdate(prevProps) {
    // focus in the same tick as the click, otherwise mobile browsers don't show the keyboard
    if (this.props.opened && !prevProps.opened) {
      this._input.focus();
    }
  }

  handleOpenSearch() {
    this.props.dispatch(openSearch());
  }

  handleCloseSearch(e) {
    if (e === true || e.target.nodeName !== 'A') {
      return false;
    }
    this.handleCloseSearchForce();
  }

  handleCloseSearchForce() {
    this.props.dispatch(closeSearch());
    this.props.dispatch(searchRequestClear());
    this._input.value = '';
  }

  handleQueryChange(e) {
    const query = e.target.value;

    this.setState({query});
    if (query.length > minQueryLength) {
      clearTimeout(timeoutRequest);
      timeoutRequest = setTimeout(() => this.props.dispatch(searchRequest(query)), 500);
    } else {
      this.props.dispatch(searchRequestClear());
    }
  }

  renderResults(response) {
    const {query} = this.state;
    const {pending} = this.props;

    if (response && response.total) {
      return response.results.map((entity, key) => {
        return (
          <div onClick={(e) => this.handleCloseSearch(e)} key={key} className="header-search__result-item">
            <MoviePreview votesFilter={0} movie={entity} />
          </div>
        );
      });
    } else if (response && query.length > minQueryLength && !pending) {
      return (<div className="header-search__result-empty">По вашему запросу ничего не найдено.</div>);
    }
  }

  render() {
    const {pending, response, opened} = this.props;

    return (
      <div className="header__right-item">
        <div className="header-search">
          <div onClick={this.handleOpenSearch} className="header-search__toggle">
            <span className="icn icn_loupe"/>
            <span className="header-search__toggle-text">Найти фильм или сериал</span>
          </div>
          <div className={'header-search__container' + (opened ? ' m-opened' : '')}>
            <div className="header-search__head">
              <input
                ref={(ref) => this._input = ref}
                onChange={this.handleQueryChange}
                className="header-search__head-input"
                type="text"
                placeholder="Фильм или сериал"
              />
              <Spinner additionClass="header-search__head-spinner" active={pending} size="small"/>
              <span className="header-search__head-icn icn icn_loupe"/>
              <span onClick={this.handleCloseSearchForce} className="header-search__head-cross icn icn_cross"/>
            </div>

            <div onClick={this.handleCloseSearchForce} className="header-search__result-wrap overlay">
              <div onClick={(e) => e.stopPropagation()} className="header-search__result">
                {this.renderResults(response)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

HeaderSearch.propTypes = propTypes;
HeaderSearch.defaultProps = defaultProps;

function mapStateToProps(state) {
  const {pending, response} = state.search.toJS();
  // opened from the header and from the mobile tab bar, so it lives in the app store
  const opened = state.app.get('searchOpened');

  return {pending, response, opened};
}

export default connect(mapStateToProps)(HeaderSearch);