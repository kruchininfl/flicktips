import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import MoviePreview from 'partitions/MoviePreview';
import {searchRequest, searchRequestClear} from 'redux/actions/searchActions';
import Spinner from 'components/Gui/Spinner';

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
      opened : this.props.opened,
      query  : this.props.query,
      pending: this.props.pending
    };
  }

  handleOpenSearch() {
    this.setState({opened: true});
    this._input.focus();
  }

  handleCloseSearch(e) {
    if (e === true || e.target.nodeName !== 'A') {
      return false;
    }
    this.handleCloseSearchForce();
  }

  handleCloseSearchForce() {
    this.setState({opened: false});
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
    const {pending, response} = this.props;
    const {opened} = this.state;

    return (
      <div className="header__right-item">
        <div className="header-search">
          <div onClick={this.handleOpenSearch} className="header-search__toggle">
            <span className="icn icn_loupe"/>
          </div>
          <div className={'header-search__container' + (opened ? ' m-opened' : '')}>
            <div className="header-search__head">
              <input
                ref={(ref) => this._input = ref}
                onChange={this.handleQueryChange}
                className="header-search__head-input"
                type="text"
                placeholder="Search..."
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

  return {pending, response};
}

export default connect(mapStateToProps)(HeaderSearch);