//@ts-check

// TODOs:
// - Combine different difficulties of a song into one song object

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
  constructor(json) {
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

    this.parseSongId_(json._leaderboardId);
    for (const score of json._scores) {
      this.scores.push(new Score(score));
    }
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
    this.name = substrs[1];
    this.artist = substrs[2];
    this.mapAuthor = substrs[3];
    this.bpm = Number(substrs[4]);
    this.difficulty = substrs[5];
  }
}

class Leaderboard {
  constructor(json) {
    /** @type {Song[]} */
    this.songs = [];
    /** @type {string[]} */
    this.players = [];

    for (const songJson of json._leaderboardsData) {
      const song = new Song(songJson);
      this.songs.push(song);
      this.addPlayers_(song.getPlayers());
    }
  }

  sortByRecent() {
    this.songs.sort((song1, song2) => {
      return Number(song2.getLatestScoreDate()) -
          Number(song1.getLatestScoreDate());
    });
  }

  sortByRecentHighScore() {
    this.songs.sort((song1, song2) => {
      return Number(song2.scores[0].date) - Number(song1.scores[0].date);
    });
  }

  sortByHighScore() {
    this.songs.sort((song1, song2) => {
      return song2.scores[0].value - song1.scores[0].value;
    });
  }

  sortAlphabetically() {
    this.songs.sort((song1, song2) => song1.name.localeCompare(song2.name));
  }

  sortByPlayCount() {
    this.songs.sort(
        (song1, song2) => song2.scores.length - song1.scores.length);
  }

  /**
   * @param {string} player
   * @returns {Song[]} Songs whose highest score is held by |player|.
   */
  getSongsForPlayer(player) {
    return this.songs.filter(song => song.scores[0].player == player);
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

/** @type {Leaderboard} */
let leaderboard;
/** @type {string} */
let selectedPlayer;

/**
 * @param {File} file
 * @returns {Promise<JSON>}
 */
function parseJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      //@ts-ignore
      resolve(JSON.parse(reader.result));
    };
    reader.readAsText(file);
  });
}

/**
 * @param {Score} score
 * @returns {HTMLElement}
 */
function createScoreElement(score) {
  const element = document.createElement('tr');
  element.innerHTML = `<td>${score.player}</td>
       <td class="align-right">${score.value}</td>
       <td class="align-right">${
      score.date.toDateString().substring(4, 10)}</td>`;
  return element;
}

/**
 * @param {Song} song
 */
function createSelectableSongElement(song) {
  const element = createSongElement(song);
  element.addEventListener('mouseup', () => selectSongElement(element, song));
  element.classList.add('highlightable');
  return element;
}

/**
 * @param {Song} song
 * @returns {HTMLElement}
 */
function createSongElement(song) {
  const element = document.createElement('div');
  element.className = 'song';
  element.innerHTML = `
      <div class="song-top-row">${song.name}
        <span class="song-artist">${song.artist}</span>
      </div>
      <div class="song-map-author">${song.mapAuthor}</div>`;
  return element;
}

/**
 * @param {Song} song
 */
function updateSongName(song) {
  const element = document.querySelector('#song-name');
  element.innerHTML = '';
  const songElement = createSongElement(song);
  songElement.addEventListener('mouseup', () => openBeastSaber(song));
  element.appendChild(songElement);
}

/**
 * @param {Song} song
 */
function openBeastSaber(song) {
  const query = `${song.name} ${song.artist}`;
  const url = `https://bsaber.com/?s=${encodeURIComponent(query)}` +
      `&orderby=relevance&order=DESC&post_type=page%2Cpost`;
  window.open(url);
}

/**
 * @param {Song} song
 */
function showScores(song) {
  updateSongName(song);
  const scoreListFragment = document.createDocumentFragment();
  for (const score of song.scores) {
    scoreListFragment.appendChild(createScoreElement(score));
  }
  const scoreList = document.querySelector('#scores');
  scoreList.innerHTML = '';
  scoreList.appendChild(scoreListFragment);
}

/**
 * @returns {string[]} Player names to filter songs for
 */
function getPlayerFilter() {
  const players = [];
  for (const element of document.getElementsByClassName(
           'player-filter-checkbox')) {
    if (element.checked) {
      players.push(element.name);
    }
  }
  return players;
}

function updateSongList() {
  const songs = selectedPlayer ? leaderboard.getSongsForPlayer(selectedPlayer) :
                                 leaderboard.songs;
  const songListFragment = document.createDocumentFragment();
  for (const song of songs) {
    songListFragment.appendChild(createSelectableSongElement(song));
  }
  const songList = document.querySelector('#songs');
  songList.innerHTML = '';
  songList.appendChild(songListFragment);

  if (songs.length > 0) {
    selectSongElement(songList.children[0], songs[0]);
  }
}

function selectPlayer(player) {
  selectedPlayer = (player == 'Anyone' ? null : player);
  switchHighLight(
      document.querySelector('#player-filter-options > .selected'),
      document.querySelector(`#player-filter-option-${player}`));
  updateSongList();
}

/**
 * @param {string} player
 * @returns {HTMLElement}
 */
function createPlayerFilterCheckbox(player) {
  const element = document.createElement('div');
  element.className = 'radio-button highlightable';
  element.id = `player-filter-option-${player}`;
  element.innerText = player;
  element.addEventListener('mouseup', () => selectPlayer(player));
  return element;
}

function updatePlayerFilter() {
  const playerFilter = document.querySelector('#player-filter-options');
  playerFilter.innerHTML = '';
  playerFilter.appendChild(createPlayerFilterCheckbox('Anyone'));
  for (const player of leaderboard.players) {
    playerFilter.appendChild(createPlayerFilterCheckbox(player));
  }
  selectPlayer('Anyone');
  /** @type {HTMLElement} */
  (document.querySelector('#player-filter')).style.display = 'block';
}

function switchHighLight(oldElement, newElement) {
  if (oldElement) {
    oldElement.classList.remove('selected');
  }
  newElement.classList.add('selected');
}

function sortByRecent() {
  leaderboard.sortByRecent();
  updateSongList();
  switchHighLight(
      document.querySelector('#sort-options > .selected'),
      document.querySelector('#sort-by-recent'));
}

function sortByRecentHighScore() {
  leaderboard.sortByRecentHighScore();
  updateSongList();
  switchHighLight(
      document.querySelector('#sort-options > .selected'),
      document.querySelector('#sort-by-recent-high-score'));
}

function sortByHighScore() {
  leaderboard.sortByHighScore();
  updateSongList();
  switchHighLight(
      document.querySelector('#sort-options > .selected'),
      document.querySelector('#sort-by-high-score'));
}

function sortAlphabetically() {
  leaderboard.sortAlphabetically();
  updateSongList();
  switchHighLight(
      document.querySelector('#sort-options > .selected'),
      document.querySelector('#sort-alphabetically'));
}

function sortByPlayCount() {
  leaderboard.sortByPlayCount();
  updateSongList();
  switchHighLight(
      document.querySelector('#sort-options > .selected'),
      document.querySelector('#sort-by-play-count'));
}

function selectSongElement(element, song) {
  switchHighLight(document.querySelector('.song.selected'), element);
  showScores(song);
}

async function onFileSelected(event) {
  /** @type {FileList} */
  const files = event.target.files;
  if (files.length == 0) {
    return;
  }
  const leaderboardJson = await parseJsonFile(files.item(0));
  leaderboard = new Leaderboard(leaderboardJson);
  updatePlayerFilter();
  sortByRecent();
  /** @type {HTMLElement} */
  (document.querySelector('#sort')).style.display = 'block';
}

function onDOMContentLoaded() {
  document.querySelector('#file-picker')
      .addEventListener('change', onFileSelected);
  document.querySelector('#sort-by-recent')
      .addEventListener('mouseup', sortByRecent);
  document.querySelector('#sort-by-recent-high-score')
      .addEventListener('mouseup', sortByRecentHighScore);
  document.querySelector('#sort-by-high-score')
      .addEventListener('mouseup', sortByHighScore);
  document.querySelector('#sort-alphabetically')
      .addEventListener('mouseup', sortAlphabetically);
  document.querySelector('#sort-by-play-count')
      .addEventListener('mouseup', sortByPlayCount);
}

document.addEventListener('DOMContentLoaded', onDOMContentLoaded);
