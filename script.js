//@ts-check

// TODOs:
// - Filter by the person on the top spot
// - Sort by number of plays
// - Sort alphabetically
// - Use LitElement (or whatever their reactive framework was called)
// - Combine different difficulties of a song into one song object
// - Link to bsaber (needs to be a search link)

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

  sortByHighScore() {
    this.songs.sort((song1, song2) => {
      return song2.scores[0].value - song1.scores[0].value;
    });
  }

  /**
   * @param {string[]} players
   * @returns {Song[]} Songs whose high score is held by a player in |players|.
   */
  getSongsForPlayers(players) {
    return this.songs.filter(
        song => players.indexOf(song.scores[0].player) != -1);
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
  const element = document.createElement('li');
  element.innerHTML = `${score.value} - ${score.player}`;
  return element;
}

/**
 * @param {Song} song
 * @returns {HTMLElement}
 */
function createSongElement(song) {
  const element = document.createElement('li');
  element.innerHTML = `${song.name}`;
  element.addEventListener('mouseup', () => showScores(song));
  return element;
}

/**
 * @param {Song} song
 */
function showScores(song) {
  document.querySelector('#song-name').innerHTML = song.name;
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
  const songs = leaderboard.getSongsForPlayers(getPlayerFilter());
  const songListFragment = document.createDocumentFragment();
  for (const song of songs) {
    songListFragment.appendChild(createSongElement(song));
  }
  const songList = document.querySelector('#songs');
  songList.innerHTML = '';
  songList.appendChild(songListFragment);

  if (songs.length > 0) {
    showScores(songs[0]);
  }
}

function onPlayerFilterChanged() {
  updateSongList();
}

/**
 * @param {string} player
 * @returns {HTMLElement}
 */
function createPlayerFilterCheckbox(player) {
  const inputElement = document.createElement('input');
  inputElement.type = 'checkbox';
  inputElement.className = 'player-filter-checkbox';
  inputElement.name = player;
  inputElement.checked = true;
  inputElement.addEventListener('change', onPlayerFilterChanged);

  const labelElement = document.createElement('label');
  labelElement.appendChild(inputElement);
  labelElement.append(player);
  const liElement = document.createElement('li');
  liElement.appendChild(labelElement);
  return liElement;
}

function updatePlayerFilter() {
  const playerFilter = document.querySelector('#player-filter');
  playerFilter.innerHTML = '';
  for (const player of leaderboard.players) {
    playerFilter.appendChild(createPlayerFilterCheckbox(player));
  }
}

function sortByRecent() {
  leaderboard.sortByRecent();
  updateSongList();
}

function sortByHighScore() {
  leaderboard.sortByHighScore();
  updateSongList();
}

async function onFileSelected(event) {
  /** @type {FileList} */
  const files = event.target.files;
  if (files.length == 0) {
    return;
  }
  const leaderboardJson = await parseJsonFile(files.item(0));
  leaderboard = new Leaderboard(leaderboardJson);
  leaderboard.sortByRecent();
  updatePlayerFilter();
  updateSongList();
}

function onDOMContentLoaded() {
  document.querySelector('#file-picker')
      .addEventListener('change', onFileSelected);
  document.querySelector('#sort-by-recent')
      .addEventListener('mouseup', sortByRecent);
  document.querySelector('#sort-by-high-score')
      .addEventListener('mouseup', sortByHighScore);
}

document.addEventListener('DOMContentLoaded', onDOMContentLoaded);
