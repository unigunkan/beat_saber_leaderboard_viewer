//@ts-check
//@ts-ignore
import {css, html, LitElement} from 'https://unpkg.com/lit-element?module';

// This allows not using shadow DOM, but all the CSS needs to be set on the root
// element:
// createRenderRoot() {
//   return this;
// }

class Score {
  constructor(json) {
    /** @type {number} */
    this.value = json._score;
    /** @type {string} */
    this.player = json._playerName;
    /** @type {boolean} */
    this.isFullCombo = json._fullCombo;
    /** @type {Date} */
    this.date = new Date(json._timestamp * 1000);
  }
}

class Song {
  constructor(json, difficulties = null) {
    /** @type {string} */
    this.name;
    /** @type {string} */
    this.artist;
    /** @type {string} */
    this.mapAuthor;
    /** @type {number} */
    this.bpm;
    /** @type {string} */
    this.difficulty;
    /** @type {Score[]} */
    this.scores = [];
    /** @type {string} */
    this.hash;
    /** @type {string} */
    this.key;
    /** @type {number} */
    this.stars;

    this.parseSongId_(json._leaderboardId);
    for (const score of json._scores) {
      this.scores.push(new Score(score));
    }
    this.getPropertiesFromDifficulties_(difficulties);
  }

  getLatestScoreDate() {
    let latestDate = null;
    for (const score of this.scores) {
      if (score.date > latestDate) {
        latestDate = score.date;
      }
    }
    return latestDate;
  }

  getPlayers() {
    const players = [];
    for (const score of this.scores) {
      if (players.indexOf(score.player) == -1) {
        players.push(score.player);
      }
    }
    return players;
  }

  /**
   * @param {Map<string, Array<object>>} difficulties
   */
  getPropertiesFromDifficulties_(difficulties) {
    if (!difficulties) {
      return;
    }
    const songDiffs = (difficulties.get(this.name) || [])
                          .find(
                              entry => entry.SongSubName == this.artist &&
                                  entry.AuthorName == this.mapAuthor);
    if (!songDiffs) {
      return;
    }
    this.key = songDiffs.Key;
    const songDiff = songDiffs.Diffs.find(diff => diff.Diff == this.difficulty);
    if (!songDiff) {
      return;
    }
    this.stars = songDiff.Stars;
  }

  /**
   * @param {string} id
   */
  parseSongId_(id) {
    if (id.indexOf('∎') == -1) {
      this.parseBuiltInSongId_(id);
    } else {
      this.parseCustomSongId_(id);
    }
  }

  /**
   * @param {string} id
   */
  parseBuiltInSongId_(id) {
    this.name = id;
  }

  /**
   * @param {string} id
   */
  parseCustomSongId_(id) {
    const substrs = id.split('∎');
    this.hash = substrs[0];
    this.name = substrs[1];
    this.artist = substrs[2];
    this.mapAuthor = substrs[3];
    this.bpm = Number(substrs[4]);
    this.difficulty = substrs[5];
  }
}

class Leaderboard {
  constructor(json, difficulties) {
    /** @type {Song[]} */
    this.songs = [];
    /** @type {string[]} */
    this.players = [];
    /** @private {Map<string, object>} */
    this.difficulties_ = difficulties;

    for (const songJson of json._leaderboardsData) {
      const song = new Song(songJson, this.difficulties_);
      this.songs.push(song);
      this.addPlayers_(song.getPlayers());
    }
  }

  /**
   * @param {string[]} players
   */
  addPlayers_(players) {
    for (const player of players) {
      if (this.players.indexOf(player) == -1) {
        this.players.push(player);
      }
    }
  }
}

class ResourceLoader {
  /**
   * @param {File} file
   * @returns {Promise<JSON>}
   */
  static parseJsonFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        //@ts-ignore
        resolve(JSON.parse(reader.result));
      };
      reader.readAsText(file);
    });
  }

  static async getDifficulties() {
    const url = 'difficulties.json';
    const difficultyList = await (await fetch(url)).json();
    /**
     * @type {Map<string, Array<object>>}
     */
    const difficulties = new Map();
    for (const difficulty of difficultyList) {
      if (difficulties.has(difficulty.SongName)) {
        difficulties.get(difficulty.SongName).push(difficulty);
      } else {
        difficulties.set(difficulty.SongName, [difficulty]);
      }
    }
    return difficulties;
  }
}

const SortType = {
  ALPHABETICAL: 'Alphabetical order',
  DATE_PLAYED: 'Date played',
  DATE_HIGH_SCORE: 'Date of high score',
  HIGH_SCORE: 'High score',
  PLAY_COUNT: 'Play count',
  DIFFICULTY_RATING: 'Difficulty rating'
};

class ScoreTableElement extends LitElement {
  constructor() {
    super();
    /** @type {Song} */
    this.song = null;
  }

  // These properties are automatically observed for changes.
  static get properties() {
    return {song: {type: Song}};
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }

      .align-right {
        text-align: right;
      }

      song-entry {
        cursor: pointer;
        margin: 20px 65px;
      }

      table {
        margin-left: 50px;
      }
  
      table tr + tr {
        border-top: 1px solid white;
      }
  
      td {
        padding: 0 20px;
      }
    `;
  }

  /**
   * @param {Score} score
   */
  createScoreRow_(score) {
    const shortDate = score.date.toDateString().substring(4, 10);
    return html`
      <tr>
        <td>${score.player}</td>
        <td class="align-right">${score.value}</td>
        <td class="align-right">${shortDate}</td>
      </tr>
    `;
  }

  openBeastSaber_() {
    const songId = this.song.key.substring(0, this.song.key.indexOf('-'));
    window.open(`https://bsaber.com/songs/${songId}`);
  }

  render() {
    return html`
      ${
        this.song ? html`
              <song-entry .song=${this.song} @click=${
                        this.openBeastSaber_}></song-entry>
              <table>
                ${this.song.scores.map(score => this.createScoreRow_(score))}
              </table>` :
                    ''}
    `;
  }
}
customElements.define('score-table', ScoreTableElement);

class SongEntryElement extends LitElement {
  constructor() {
    super();
    /**
     * @type {Song}
     */
    this.song = null;
    this.showTopPlayer = false;
  }

  static get properties() {
    return {showTopPlayer: {type: Boolean}, song: {type: Song}};
  }

  static get styles() {
    return css`
      :host {
        display: block;
        padding: 8px;
      }

      .song-artist {
        font-size: 0.8em;
      }

      .song-bottom-row {
        font-size: 0.8em;
        margin-top: -3px;
        opacity: 0.5;
      }

      .song-top-row {
        line-height: 28px;
        text-overflow: ellipsis;
      }

      span {
        margin-right: 15px;
      }
    `;
  }

  render() {
    return html`
      <div class="song-top-row">
        <span class="song-name">${this.song.name}</span>
        <span class="song-artist">${this.song.artist}</span>
      </div>
      <div class="song-bottom-row">
        <span>${this.song.mapAuthor}</span>
        ${this.song.stars ? html`<span>${this.song.stars}</span>` : ''}
        ${
        this.showTopPlayer ? html`<span>${this.song.scores[0].player}</span>` :
                             ''}
      </div>
    `;
  }
}
customElements.define('song-entry', SongEntryElement);

class SongListElement extends LitElement {
  constructor() {
    super();
    this.playerFilter_ = 'Anyone';
    this.selectedSong = null;
    this.selectionCallback = null;
    this.songs_ = [];
    this.sort_ = SortType.DATE_PLAYED;
  }

  static get properties() {
    return {
      playerFilter: {type: String},
      selectedSong: {type: Song},
      songs: {type: Array},
      sort: {type: SortType}
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }

      .highlightable:hover {
        background-color: white;
        color: #1c344f;
      }

      .selected {
        background-color: white;
        color: #1c344f;
      }
    `;
  }

  set playerFilter(newPlayerFilter) {
    if (newPlayerFilter == this.playerFilter_) {
      return;
    }
    const oldPlayerFilter = this.playerFilter_;
    this.playerFilter_ = newPlayerFilter;
    this.selectTopSong_();
    //@ts-ignore
    this.requestUpdate('playerFilter', oldPlayerFilter);
  }
  get playerFilter() {
    return this.playerFilter_;
  }

  set songs(newSongs) {
    if (newSongs == this.songs_) {
      return;
    }
    const oldSongs = this.songs_;
    this.songs_ = newSongs;
    this.sortSongs_();
    this.selectTopSong_();
    //@ts-ignore
    this.requestUpdate('songs', oldSongs);
  }
  get songs() {
    return this.songs_;
  }

  set sort(newSort) {
    if (newSort == this.sort_) {
      return;
    }
    const oldSort = this.sort_;
    this.sort_ = newSort;
    this.sortSongs_();
    this.selectTopSong_();
    //@ts-ignore
    this.requestUpdate('sort', oldSort);
  }
  get sort() {
    return this.sort_;
  }

  /**
   * @param {Song} song
   */
  createSongEntry_(song) {
    const isSelected = song == this.selectedSong;
    return html`
      <song-entry
        class="highlightable ${isSelected ? 'selected' : ''}"
        @click=${() => this.selectionCallback(song)}
        .song=${song}
        .showTopPlayer=${true}>
      </song-entry>
    `;
  }

  getFilteredSongs_() {
    if (this.playerFilter_ == 'Anyone') {
      return this.songs;
    } else {
      return this.getSongsForPlayer_(this.playerFilter_);
    }
  }

  /**
   * @param {string} player
   * @returns {Song[]} Songs whose highest score is held by |player|.
   */
  getSongsForPlayer_(player) {
    return this.songs.filter(song => song.scores[0].player == player);
  }

  selectTopSong_() {
    const songs = this.getFilteredSongs_();
    if (songs.length > 0 && this.selectionCallback) {
      setTimeout((song => () => this.selectionCallback(song))(songs[0]));
    }
  }

  sortByRecent_() {
    this.songs.sort((song1, song2) => {
      return Number(song2.getLatestScoreDate()) -
          Number(song1.getLatestScoreDate());
    });
  }

  sortByRecentHighScore_() {
    this.songs.sort((song1, song2) => {
      return Number(song2.scores[0].date) - Number(song1.scores[0].date);
    });
  }

  sortByHighScore_() {
    this.songs.sort((song1, song2) => {
      return song2.scores[0].value - song1.scores[0].value;
    });
  }

  sortAlphabetically_() {
    this.songs.sort((song1, song2) => song1.name.localeCompare(song2.name));
  }

  sortByPlayCount_() {
    this.songs.sort(
        (song1, song2) => song2.scores.length - song1.scores.length);
  }

  sortByDifficultyRating_() {
    this.songs.sort((song1, song2) => (song2.stars || 0) - (song1.stars || 0));
  }

  sortSongs_() {
    switch (this.sort_) {
      case SortType.DATE_PLAYED:
        this.sortByRecent_();
        break;
      case SortType.DATE_HIGH_SCORE:
        this.sortByRecentHighScore_();
        break;
      case SortType.HIGH_SCORE:
        this.sortByHighScore_();
        break;
      case SortType.ALPHABETICAL:
        this.sortAlphabetically_();
        break;
      case SortType.PLAY_COUNT:
        this.sortByPlayCount_();
        break;
      case SortType.DIFFICULTY_RATING:
        this.sortByDifficultyRating_();
    }
  }

  render() {
    return html`
      ${this.getFilteredSongs_().map(song => this.createSongEntry_(song))}
    `;
  }
}
customElements.define('song-list', SongListElement);

class RadioButtonsElement extends LitElement {
  constructor() {
    super();
    this.options = [];
    this.selectedOption = null;
    this.selectionCallback = null;
    this.title = '';
  }

  static get properties() {
    return {
      options: {type: Array},
      selectedOption: {type: Object},
      selectionCallback: {type: Function},
      title: {type: String}
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
        margin-top: 25px;
      }

      .highlightable:hover {
        background-color: white;
        color: #1c344f;
      }

      .radio-button {
        padding: 5px 15px;
      }
      
      .radio-buttons {
        margin: 0 auto 5px auto;
        overflow: hidden;
        width: 250px;
      }

      .round-outline {
        box-shadow: 0 0 0 2px #1c344f,
                    0 0 0 4px white;
        border-radius: 25px;
      }

      .selected {
        background-color: white;
        color: #1c344f;
      }
    `;
  }

  createRadioButton_(option) {
    const isSelected = option == this.selectedOption;
    return html`
      <div class="radio-button highlightable${isSelected ? ' selected' : ''}"
        @click=${() => this.onOptionSelected_(option)}>${option}</div>
    `;
  }

  onOptionSelected_(option) {
    if (this.selectionCallback) {
      this.selectionCallback(option);
    }
  }

  render() {
    return html`
      <div style="text-align: center">${this.title}</div>
      <div class="round-outline radio-buttons">
        ${this.options.map(option => this.createRadioButton_(option))}
      </div>
    `;
  }
}
customElements.define('radio-buttons', RadioButtonsElement);

class LeaderboardElement extends LitElement {
  constructor() {
    super();
    this.leaderboard = null;
    this.playerFilter = 'Anyone';
    this.selectedSong = null;
    this.sort = SortType.DATE_PLAYED;
    ResourceLoader.getDifficulties().then(
        difficulties => this.difficulties = difficulties);
  }

  // These properties are automatically observed for changes.
  // Reassignment triggers a refresh, but other changes don't seem to.
  static get properties() {
    return {
      leaderboard: {type: Leaderboard},
      playerFilter: {type: String},
      selectedSong: {type: Song},
      sort: {type: SortType}
    };
  }

  static get styles() {
    // :host applies to |this|.
    return css`
      :host {
        background: linear-gradient(0deg, #060c11 0%, #1c344f 100%);
        background-size: cover;
        color: white;
        cursor: default;
        display: block;
        font-family: 'Teko';
        font-size: 25px;
        height: 100vh;
        margin: 0;
        width: 100vw;
      }

      .button {
        display: inline-block;
        margin: 25px;
        padding: 5px 15px;
      }
      
      .column {
        float: left;
        margin: 0;
        max-height: 100%;
        overflow: auto;
        width: 400px;
      }

      #file-picker {
        display: none;
      }

      .highlightable:hover {
        background-color: white;
        color: #1c344f;
      }

      #main {
        height: 100%;
        margin: 0 auto;
        width: 1200px;
      }

      .round-outline {
        box-shadow: 0 0 0 2px #1c344f,
                    0 0 0 4px white;
        border-radius: 25px;
      }
    `;
  }

  getPlayerFilters_() {
    let filters = ['Anyone'];
    if (this.leaderboard) {
      filters = filters.concat(this.leaderboard.players);
    }
    return filters;
  }

  getSortTypes_() {
    return [
      SortType.DATE_PLAYED, SortType.DATE_HIGH_SCORE, SortType.HIGH_SCORE,
      SortType.ALPHABETICAL, SortType.PLAY_COUNT, SortType.DIFFICULTY_RATING
    ];
  }

  async onFileSelected(event) {
    /** @type {FileList} */
    const files = event.target.files;
    if (files.length == 0) {
      return;
    }
    const leaderboardJson = await ResourceLoader.parseJsonFile(files.item(0));
    this.leaderboard = new Leaderboard(leaderboardJson, this.difficulties);
    if (this.leaderboard.songs.length > 0) {
      this.selectedSong = this.leaderboard.songs[0];
    }
  }

  setPlayerFilter_(playerFilter) {
    this.playerFilter = playerFilter;
  }

  setSort_(sort) {
    this.sort = sort;
  }

  setSelectedSong_(song) {
    this.selectedSong = song;
  }

  render() {
    return html`
      <div id="main">
        <div class="column">
          <div id="file-picker-container" style="text-align: center"
            ?hidden=${this.leaderboard}>
            <label class="button highlightable round-outline">
              <input
                type="file"
                id="file-picker"
                @change=${this.onFileSelected} />
              Locate LocalLeaderboards.dat
            </label>
          </div>
          <div ?hidden=${!this.leaderboard}>
            <radio-buttons
              .title=${'Sort by:'}
              .options=${this.getSortTypes_()}
              .selectedOption=${this.sort}
              .selectionCallback=${sort => this.setSort_(sort)}>
            </radio-buttons>
            <radio-buttons
              .title=${'High score held by:'}
              .options=${this.getPlayerFilters_()}
              .selectedOption=${this.playerFilter}
              .selectionCallback=${player => this.setPlayerFilter_(player)}>
            </radio-buttons>
          </div>
        </div>
        <song-list
          class="column"
          .playerFilter=${this.playerFilter}
          .selectedSong=${this.selectedSong}
          .selectionCallback=${song => this.setSelectedSong_(song)}
          .songs=${this.leaderboard ? this.leaderboard.songs : []}
          .sort=${this.sort}>
        </song-list>
        <score-table class="column" .song=${this.selectedSong}></score-table>
      </div>
    `;
  }
}
customElements.define('leaderboard-element', LeaderboardElement);
