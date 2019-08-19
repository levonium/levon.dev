(() => {
  const state = {
    shouldRecordCommand: false,
    shouldStartEditor: true,
    qConfirmation: false,
    openPopup: ''
  }

  const vim = document.getElementById('vim')
  const banner = vim.querySelector('.banner')
  const editor = vim.querySelector('.editor')
  const popup = vim.querySelector('.popup')
  const statusBar = vim.querySelector('.vim .status-bar')
  const colonSpan = statusBar.querySelector('.vim .status-bar--colon')
  const commandSpan = statusBar.querySelector('.vim .status-bar--command')
  const errorSpan = statusBar.querySelector('.vim .status-bar--error')
  const modeSpan = statusBar.querySelector('.vim .status-bar--mode')
  const qSpan = statusBar.querySelector('.vim .status-bar--q')

  const show = el => el.classList.remove('hidden')
  const showAll = els => els.forEach(el => show(el))
  const hide = el => el.classList.add('hidden')
  const hideAll = els => els.forEach(el => hide(el))

  // START THE BLINKING EDITOR CARET
  blink()

  // EDITOR
  document.addEventListener('keyup', (e) => {
    // key === i => Insert mode
    if (e.keyCode === 73 &&
      state.shouldStartEditor && !editor.isContentEditable) {
      editor.setAttribute('contenteditable', 'true')
      show(editor.querySelector('div'))
      editor.focus()
      toggleEditorCaret()
      show(modeSpan)
      toggleErrorSpan()
      hide(banner)
      closePopup()
    }
  })
  editor.addEventListener('keydown', (e) => {
    if (e.keyCode === 27) { // key === Esc
      editor.removeAttribute('contenteditable')
      toggleEditorCaret()
      show(banner)
      // exitCommandMode() <- @TODO: WHY WAS THIS HERE?
    }
  })

  // STATUS BAR
  document.addEventListener('keydown', (e) => {
    if (e.keyCode === 16) { // key = shift
      document.addEventListener('keydown', (e) => {
        if (e.keyCode === 186 || e.keyCode === 59) { // key = colon
          state.shouldRecordCommand = true
          state.shouldStartEditor = false
          toggleStatusBar()
          listenToKeyEvents(state.shouldRecordCommand)
        }
      }, { once: true })
    } else if (e.keyCode === 27) {
      closePopup()
    } else {
      state.shouldRecordCommand = false
    }
  })

  // COMMANDS
  function listenToKeyEvents (shouldRecordCommand) {
    let command = ''

    document.addEventListener('keydown', (e) => {
      if (shouldRecordCommand === false) return

      if (e.keyCode in letterKeys) { // @TODO: maybe add ! => e.keyCode === 49
        command = `${commandSpan.innerText}${e.key}`
        updateCommand(command)
      }

      if (e.keyCode === 13) { // key === Enter
        if (command.length === 0) return
        executeCommand(command)
        shouldRecordCommand = false
        state.shouldStartEditor = true
      }

      if (e.keyCode === 27) { // key === Esc
        exitCommandMode()
        shouldRecordCommand = false
        state.shouldStartEditor = true
      }

      if (e.keyCode === 8) { // key === Backspace
        if (command.length === 0) {
          exitCommandMode()
          shouldRecordCommand = false
          state.shouldStartEditor = true
          return
        }
        command = command.slice(0, -1)
        updateCommand(command)
      }
    })
  }
  function executeCommand (command) {
    if (legalCommands.includes(command)) {
      if (command !== 'q') {
        openPopup(command)
        state.qConfirmation = false
      } else {
        state.qConfirmation = true
        show(qSpan)
      }
    } else if (command in secondaryCommands) {
      secondaryCommands[command].article === state.openPopup ? secondaryCommands[command].fn() : toggleErrorSpan(command)
    } else if (command in qCommands) {
      state.qConfirmation ? qCommands[command].fn() : toggleErrorSpan(command)
      state.qConfirmation = false
    } else {
      toggleErrorSpan(command)
    }
    exitCommandMode()
  }
  function updateCommand (command) {
    commandSpan.innerText = command
  }

  // TOGGLE WRAPPERS
  function toggleStatusBar () {
    showAll([colonSpan, commandSpan])
    hide(qSpan)
    toggleErrorSpan()
    toggleEditorCaret()
  }
  function exitCommandMode () {
    hideAll([modeSpan, colonSpan, commandSpan])
    commandSpan.innerText = ''
    toggleEditorCaret()
  }
  function toggleErrorSpan (command = '') {
    command === '' ? hide(errorSpan) : show(errorSpan)
    errorSpan.querySelector('.status-bar--error--command').innerText = command
  }
  function toggleEditorCaret () {
    if (editor.classList.contains('has-caret')) {
      editor.classList.remove('has-caret')
    } else {
      !editor.innerText && editor.classList.add('has-caret')
    }
  }

  // POPUP
  function openPopup (command) {
    state.openPopup = command
    show(popup)
    popup.querySelector('.popup--wrapper').focus()
    popup.querySelectorAll('article').forEach(article => hide(article))
    show(popup.querySelector(`article.popup--${command}`))
  }
  function closePopup () {
    hide(popup)
    popup.querySelectorAll('article').forEach(article => hide(article))
    state.openPopup = ''
  }

  // CARET BLINKING
  function blink () {
    if (document.body.clientWidth < 584) return
    const haveCarets = document.querySelectorAll('.has-caret')
    window.setInterval(function () {
      haveCarets.forEach(caret => {
        if (caret.classList.contains('hidden')) return
        if (!caret.classList.contains('has-caret')) return
        caret.classList.toggle('blink')
      })
    }, 500)
  }

  // Q FUNCTIONS
  const qYes = () => alert('Sorry, I can\'t close the browser tab for, you\'ll have to do it yourself. Bye.')
  const qNo = () => hide(qSpan)
  const qCommands = {
    yes: { fn: () => qYes() },
    no: { fn: () => qNo() }
  }

  // SECONDARY COMMANDS AND FUNCTIONS
  function copyFn () {
    const temp = document.createElement('input')
    temp.value = ['levon', 'avetyan@gmail', 'com'].join('.')
    document.body.appendChild(temp)
    temp.select()
    document.execCommand('copy')
    document.body.removeChild(temp)
  }
  function fixPhotoFn () {
    document.getElementById('levon').style.filter = 'unset'
  }
  function openLinkFn () {
    const link = document.createElement('a')
    link.innerText = 'source'
    hide(link)
    link.setAttribute('href', 'https://github.com/levonium/levondev')
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noopener,noreferrer')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
  function changeTheme ({ theme, colors }) {
    vim.classList.remove(theme)
    document.body.style.setProperty('--color-bg', colors.bg)
    document.body.style.setProperty('--color-font', colors.font)
    document.body.style.setProperty('--color-key', colors.key)
  }
  const lightColors = {
    bg: '#f1f1f1',
    font: '#1a1a1a',
    key: '#0037ff'
  }
  const darkColors = {
    bg: 'rgb(40, 50, 55)',
    font: '#fff',
    key: 'rgb(96, 185, 236)'
  }
  const secondaryCommands = {
    copy: { article: 'email', fn: () => copyFn() },
    fix: { article: 'photo', fn: () => fixPhotoFn() },
    open: { article: 'source', fn: () => openLinkFn() },
    'theme light': { article: 'settings', fn: () => changeTheme({ theme: 'light', colors: lightColors }) },
    'theme dark': { article: 'settings', fn: () => changeTheme({ theme: 'dark', colors: darkColors }) }
  }

  // LEGAL COMMANDS AND LETTER KEYS
  const legalCommands = [
    'q', 'help', 'settings', 'email', 'photo', 'offer', 'privacy', 'terms'
  ]
  // 'source'
  const letterKeys = {
    32: ' ',
    65: 'a',
    66: 'b',
    67: 'c',
    68: 'd',
    69: 'e',
    70: 'f',
    71: 'g',
    72: 'h',
    73: 'i',
    74: 'j',
    75: 'k',
    76: 'l',
    77: 'm',
    78: 'n',
    79: 'o',
    80: 'p',
    81: 'q',
    82: 'r',
    83: 's',
    84: 't',
    85: 'u',
    86: 'v',
    87: 'w',
    88: 'x',
    89: 'y',
    90: 'z'
  }

  // SM SCREEN SELECTORS AND EVENT LISTENERS
  const smClosePopupButton = document.querySelector('.controls--top')
  smClosePopupButton.addEventListener('click', () => {
    closePopup()
    hide(smClosePopupButton)
  })
  document.querySelectorAll('[data-section]')
    .forEach(button => button.addEventListener('click', (e) => {
      openPopup(e.target.dataset.section)
      show(smClosePopupButton)
    }))
  document.querySelectorAll('[data-fn]')
    .forEach(button => button.addEventListener('click', (e) => {
      const fnName = e.target.dataset.fn.replace('-', ' ')
      const fn = secondaryCommands[fnName].fn
      fn()
    }))
})()
