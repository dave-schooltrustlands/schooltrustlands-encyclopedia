// Private research office: everything the pages do in the browser.
// One plain script file, served from this site, with no inline script on any
// office page. That lets the server send a strict content policy
// (script-src 'self'), so text in a bot reply can never run as code.
// Every call that changes something carries the X-Office-Request header; the
// server refuses changes that do not come from these pages.
(function () {
  'use strict';

  var MAX_RECORD_SECONDS = 600;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function say(node, text, tone) {
    if (!node) return;
    node.textContent = text || '';
    if (tone) node.setAttribute('data-tone', tone); else node.removeAttribute('data-tone');
  }
  function sizeText(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return Math.max(1, Math.round(n / 1024)) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }
  function newKey() {
    var a = new Uint8Array(12);
    crypto.getRandomValues(a);
    return 'c-' + Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  // One way to call the office API. Resolves with the parsed JSON, or rejects
  // with an Error whose message is safe to show.
  function api(path, opts) {
    opts = opts || {};
    var headers = { 'X-Office-Request': '1' };
    var body = opts.body;
    if (opts.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.json);
    }
    if (opts.type) headers['Content-Type'] = opts.type;
    return fetch(path, { method: opts.method || 'GET', headers: headers, body: body, credentials: 'same-origin', cache: 'no-store' })
      .then(function (res) {
        return res.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
          if (res.ok && data) return data;
          var message = data && data.error && data.error.message;
          if (!message) {
            // Not our JSON: most likely the sign-in has run out and the request was turned away.
            message = res.status === 401 || res.status === 403 || res.status === 0 || !data
              ? 'Your sign-in may have run out. Copy anything you have typed, then reload this page.'
              : 'Something went wrong. Please try again.';
          }
          var err = new Error(message);
          err.status = res.status;
          err.code = data && data.error && data.error.code;
          throw err;
        });
      }, function () {
        throw new Error('The office could not be reached. Check your connection. If that is fine, your sign-in may have run out: copy anything you have typed, then reload this page.');
      });
  }

  // ------------------------------------------------------------ composer

  function setupComposer(root) {
    var mode = root.getAttribute('data-mode');
    var requestId = root.getAttribute('data-request-id');
    var maxBytes = Number(root.getAttribute('data-max-bytes')) || 26214400;
    var maxFiles = Number(root.getAttribute('data-max-files')) || 10;
    var canTranscribe = root.getAttribute('data-transcribe') === '1';
    var bodyEl = $('[data-body]', root);
    var titleEl = $('[data-title]', root);
    var listEl = $('[data-files]', root);
    var statusEl = $('[data-status]', root);
    var sendBtn = $('[data-send]', root);
    var recBtn = $('[data-record]', root);
    var recTime = $('[data-rec-time]', root);
    var fileInput = $('[data-file-input]', root);
    var recLabel = $('[data-record-label]', root);
    var dropHint = $('[data-drop-hint]', root);
    function setRecLabel(text) { if (recLabel) recLabel.textContent = text; else recBtn.textContent = text; }

    var items = [];      // { id, name, size, kind, blobUrl }
    var busy = 0;        // uploads or transcriptions in flight
    var sending = false;
    var clientKey = newKey();
    var dirty = false;

    function refreshSend() { sendBtn.disabled = sending || busy > 0; }
    // The thread page asks this before refreshing itself, so that a reload
    // never throws away typed text, attached files, or a recording in progress.
    root.officeHasWork = function () {
      return sending || busy > 0 || items.length > 0 || !!bodyEl.value.trim() || !!(recorder && recorder.state === 'recording');
    };
    function setBusy(delta) { busy += delta; refreshSend(); }

    function render() {
      listEl.textContent = '';
      items.forEach(function (it) {
        var li = el('li', 'of-file');
        li.appendChild(el('span', 'of-file-name', it.name));
        li.appendChild(el('span', 'of-file-size', (it.kind === 'voice' ? 'Voice recording · ' : '') + sizeText(it.size)));
        var rm = el('button', 'of-btn of-btn--quiet', 'Remove');
        rm.type = 'button';
        rm.setAttribute('aria-label', 'Remove ' + it.name);
        rm.addEventListener('click', function () { removeItem(it); });
        li.appendChild(rm);
        if (it.blobUrl) {
          var audio = document.createElement('audio');
          audio.controls = true; audio.preload = 'metadata'; audio.src = it.blobUrl;
          li.appendChild(audio);
        }
        listEl.appendChild(li);
      });
    }

    function removeItem(it) {
      items = items.filter(function (x) { return x !== it; });
      if (it.blobUrl) URL.revokeObjectURL(it.blobUrl);
      render();
      api('/api/office/attachments/' + it.id, { method: 'DELETE' }).catch(function () { /* it expires by itself */ });
    }

    function upload(file, kind) {
      if (items.length + busy >= maxFiles) {
        say(statusEl, 'You can attach up to ' + maxFiles + ' files to one message.', 'error');
        return Promise.resolve(null);
      }
      var allowed = ((fileInput && fileInput.getAttribute('accept')) || '').split(',');
      var ext = file.name.lastIndexOf('.') > 0 ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';
      if (allowed.length > 1 && allowed.indexOf(ext) === -1) {
        say(statusEl, '"' + file.name + '" was not attached: files of that kind are not accepted here.', 'error');
        return Promise.resolve(null);
      }
      if (file.size > maxBytes) {
        say(statusEl, '"' + file.name + '" is larger than ' + sizeText(maxBytes) + ' and was not attached.', 'error');
        return Promise.resolve(null);
      }
      if (!file.size) {
        say(statusEl, '"' + file.name + '" is empty and was not attached.', 'error');
        return Promise.resolve(null);
      }
      setBusy(1);
      dirty = true;
      say(statusEl, 'Adding ' + file.name + '…');
      return api('/api/office/uploads?kind=' + kind + '&filename=' + encodeURIComponent(file.name), {
        method: 'POST', body: file, type: 'application/octet-stream',
      }).then(function (data) {
        var a = data.attachment;
        var it = { id: a.id, name: a.filename, size: a.size, kind: kind, blobUrl: kind === 'voice' ? URL.createObjectURL(file) : null };
        items.push(it);
        render();
        say(statusEl, 'Added ' + a.filename + '.', 'good');
        return it;
      }).catch(function (err) {
        say(statusEl, err.message, 'error');
        return null;
      }).then(function (it) { setBusy(-1); return it; });
    }

    if (fileInput) {
      fileInput.addEventListener('change', function () {
        var files = Array.prototype.slice.call(fileInput.files || []);
        fileInput.value = '';
        // One at a time keeps the order and the status line readable.
        files.reduce(function (chain, f) { return chain.then(function () { return upload(f, 'file'); }); }, Promise.resolve());
      });
    }

    // ---- voice

    var recorder = null, chunks = [], stream = null, timer = null, startedAt = 0;

    function pickMime() {
      var options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
      for (var i = 0; i < options.length; i++) {
        if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(options[i])) return options[i];
      }
      return '';
    }
    function extFor(type) {
      if (type.indexOf('mp4') > -1) return 'm4a';
      if (type.indexOf('ogg') > -1) return 'ogg';
      return 'webm';
    }
    function tick() {
      var s = Math.floor((Date.now() - startedAt) / 1000);
      recTime.textContent = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
      if (s >= MAX_RECORD_SECONDS) stopRecording();
    }
    function stopRecording() {
      if (recorder && recorder.state === 'recording') recorder.stop();
    }
    function resetRecordButton() {
      clearInterval(timer);
      setRecLabel('Talk instead of typing');
      recBtn.classList.remove('of-btn--recording');
      recBtn.setAttribute('aria-pressed', 'false');
      recTime.hidden = true;
      if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null; recorder = null;
    }

    function transcribe(it) {
      setBusy(1);
      say(statusEl, 'Turning your recording into text…');
      return api('/api/office/transcribe', { method: 'POST', json: { attachment_id: it.id } }).then(function (data) {
        var text = (data.text || '').trim();
        if (!text) {
          say(statusEl, 'No words were picked up in that recording. It is still attached; you can also type your request.', 'error');
          return;
        }
        bodyEl.value = (bodyEl.value.trim() ? bodyEl.value.replace(/\s+$/, '') + '\n\n' : '') + text;
        bodyEl.focus();
        say(statusEl, 'Your words are in the box above. Read them over, fix anything that came out wrong, then press Send.', 'good');
      }).catch(function (err) {
        say(statusEl, err.message, err.code === 'transcription_unavailable' ? null : 'error');
      }).then(function () { setBusy(-1); });
    }

    if (recBtn) {
      recBtn.addEventListener('click', function () {
        if (recorder && recorder.state === 'recording') { stopRecording(); return; }
        if (!navigator.mediaDevices || !window.MediaRecorder) {
          say(statusEl, 'This browser cannot record sound. Please type instead, or attach a recording as a file.', 'error');
          return;
        }
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
          stream = s; chunks = [];
          var mime = pickMime();
          recorder = mime ? new MediaRecorder(s, { mimeType: mime }) : new MediaRecorder(s);
          recorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
          recorder.onstop = function () {
            var type = (recorder && recorder.mimeType) || (chunks[0] && chunks[0].type) || 'audio/webm';
            var blob = new Blob(chunks, { type: type });
            resetRecordButton();
            if (!blob.size) { say(statusEl, 'Nothing was recorded. Please try again.', 'error'); return; }
            var stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
            var file = new File([blob], 'voice-' + stamp + '.' + extFor(type), { type: type });
            upload(file, 'voice').then(function (it) {
              if (!it) return;
              if (canTranscribe) return transcribe(it);
              say(statusEl, 'Recording attached. The helper will receive it as audio. You can add a typed note too.', 'good');
            });
          };
          recorder.start();
          startedAt = Date.now();
          setRecLabel('Stop recording');
          recBtn.classList.add('of-btn--recording');
          recBtn.setAttribute('aria-pressed', 'true');
          recTime.hidden = false; recTime.textContent = '0:00';
          timer = setInterval(tick, 500);
          say(statusEl, 'Recording now. Speak, then press “Stop recording” when you are done (10 minutes at most).');
        }).catch(function () {
          say(statusEl, 'The microphone could not be used. If your browser asked about the microphone, choose Allow, then press the button again.', 'error');
        });
      });
    }

    // ---- examples: tap one to put it in the box, ready to change
    $all('[data-example]', root).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var text = btn.getAttribute('data-example') || '';
        if (bodyEl.value.trim() && bodyEl.value.trim() !== text) bodyEl.value = bodyEl.value.replace(/\s+$/, '') + '\n\n' + text;
        else bodyEl.value = text;
        dirty = true;
        bodyEl.focus();
        try { bodyEl.setSelectionRange(bodyEl.value.length, bodyEl.value.length); } catch (e) { /* older browsers */ }
        say(statusEl, 'The example is in the box. Change it to say exactly what you need, then press Send.');
      });
    });

    // ---- the send button names the chosen helper
    var sendName = $('[data-send-name]', root);
    $all('input[name="of-bot"]', root).forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (radio.checked && sendName) sendName.textContent = radio.getAttribute('data-bot-name') || 'the helper';
      });
    });

    // ---- drag and drop files anywhere on the box
    var dragDepth = 0;
    function hasFiles(e) {
      var types = e.dataTransfer && e.dataTransfer.types;
      return !!types && Array.prototype.indexOf.call(types, 'Files') > -1;
    }
    function dragState(on) {
      if (on) root.setAttribute('data-dragging', '1'); else root.removeAttribute('data-dragging');
      if (dropHint) dropHint.hidden = !on;
    }
    root.addEventListener('dragenter', function (e) { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; dragState(true); });
    root.addEventListener('dragover', function (e) { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    root.addEventListener('dragleave', function (e) { if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) dragState(false); });
    root.addEventListener('drop', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth = 0; dragState(false);
      var files = Array.prototype.slice.call(e.dataTransfer.files || []);
      files.reduce(function (chain, f) { return chain.then(function () { return upload(f, 'file'); }); }, Promise.resolve());
    });

    // ---- send

    bodyEl.addEventListener('input', function () { dirty = true; });
    window.addEventListener('beforeunload', function (e) {
      var recording = recorder && recorder.state === 'recording';
      if (!sending && (busy > 0 || recording || (dirty && (bodyEl.value.trim() || items.length)))) { e.preventDefault(); e.returnValue = ''; }
    });

    sendBtn.addEventListener('click', function () {
      if (sending || busy > 0) return;
      if (recorder && recorder.state === 'recording') { say(statusEl, 'Stop the recording first.', 'error'); return; }
      var text = bodyEl.value.trim();
      if (!text && !items.length) {
        say(statusEl, mode === 'new' ? 'The box is empty. Type what you need, press “Talk instead of typing”, or attach a file.' : 'The box is empty. Type a message, talk, or attach a file.', 'error');
        bodyEl.focus();
        return;
      }
      var payload = { body: text, attachment_ids: items.map(function (it) { return it.id; }), client_key: clientKey };
      var path;
      if (mode === 'new') {
        var chosen = $('input[name="of-bot"]:checked', root);
        if (!chosen) { say(statusEl, 'Choose a helper to send this to.', 'error'); return; }
        payload.bot_id = chosen.value;
        payload.title = titleEl ? titleEl.value.trim() : '';
        path = '/api/office/requests';
      } else {
        path = '/api/office/requests/' + requestId + '/messages';
      }
      sending = true; refreshSend();
      say(statusEl, 'Sending…');
      sendBtn.setAttribute('aria-busy', 'true');
      api(path, { method: 'POST', json: payload }).then(function (data) {
        dirty = false;
        say(statusEl, 'Sent. Opening your request…', 'good');
        if (mode === 'new') window.location.assign(data.url);
        else window.location.reload();
      }).catch(function (err) {
        sending = false; refreshSend();
        sendBtn.removeAttribute('aria-busy');
        say(statusEl, err.message + ' Nothing was lost: your text and files are still here.', 'error');
      });
    });

    render();
  }

  // -------------------------------------------------------------- thread

  function setupThread(root) {
    var id = root.getAttribute('data-request-id');
    var statusEl = $('[data-thread-status]');
    var base = '/api/office/requests/' + id + '/';

    // Quiet refresh: while a bot has the request, look for news every 30 seconds.
    // "News" is a change of status or a new message. If the owner is in the
    // middle of writing, recording, or attaching, show a notice instead of reloading.
    var version = root.getAttribute('data-version');
    var fresh = $('[data-fresh]', root);
    var composer = $('[data-composer]', root);
    function check() {
      if (document.hidden) return;
      api(base + 'state').then(function (s) {
        if (s.status + '|' + s.message_count === version) return;
        var working = composer && composer.officeHasWork && composer.officeHasWork();
        if (working) { if (fresh) fresh.hidden = false; } else window.location.reload();
      }).catch(function () { /* try again next time */ });
    }
    if (root.getAttribute('data-watch') === '1') setInterval(check, 30000);
    var reload = $('[data-reload]', root);
    if (reload) reload.addEventListener('click', function () { window.location.reload(); });

    function act(action, json, done) {
      say(statusEl, 'Working…');
      return api(base + action, { method: 'POST', json: json === undefined ? undefined : json }).then(done).catch(function (err) {
        say(statusEl, err.message, 'error');
      });
    }

    var retry = $('[data-retry]', root);
    if (retry) retry.addEventListener('click', function () {
      retry.disabled = true;
      act('retry', undefined, function () { window.location.reload(); });
    });

    var del = $('[data-delete]', root), confirmBox = $('[data-delete-confirm]', root);
    if (del && confirmBox) {
      del.addEventListener('click', function () { del.hidden = true; confirmBox.hidden = false; $('[data-delete-no]', confirmBox).focus(); });
      $('[data-delete-no]', confirmBox).addEventListener('click', function () { confirmBox.hidden = true; del.hidden = false; del.focus(); });
      $('[data-delete-yes]', confirmBox).addEventListener('click', function () {
        act('delete', undefined, function () { window.location.assign('/office/'); });
      });
    }

    $all('[data-nominate]', root).forEach(function (box) {
      var send = $('[data-nominate-send]', box);
      send.addEventListener('click', function () {
        send.disabled = true;
        act('nominate', {
          message_id: box.getAttribute('data-nominate'),
          note: $('[data-nominate-note]', box).value.trim(),
          attachment_ids: $all('[data-nominate-file]:checked', box).map(function (c) { return c.value; }),
        }, function () { window.location.reload(); }).then(function () { send.disabled = false; });
      });
    });

    $all('[data-withdraw]', root).forEach(function (btn) {
      btn.addEventListener('click', function () {
        btn.disabled = true;
        act('withdraw', { publication_id: btn.getAttribute('data-withdraw') }, function () { window.location.reload(); });
      });
    });
  }

  // --------------------------------------------------------------- admin

  function setupAdmin() {
    var statusEl = $('[data-admin-status]');
    function admin(action, json) {
      say(statusEl, 'Working…');
      return api('/api/office/admin/' + action, { method: 'POST', json: json }).then(function (data) {
        say(statusEl, 'Done.', 'good');
        return data;
      }, function (err) {
        say(statusEl, err.message, 'error');
        statusEl.scrollIntoView({ block: 'center' });
        return null;
      });
    }
    function reloadSoon(data) { if (data) window.location.reload(); }

    // Bots
    $all('[data-bot-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $('[data-bot-id]').value = btn.getAttribute('data-id');
        $('[data-bot-name-input]').value = btn.getAttribute('data-name');
        $('[data-bot-desc]').value = btn.getAttribute('data-description');
        $('[data-bot-sort]').value = btn.getAttribute('data-sort');
        $('[data-bot-hook]').value = btn.getAttribute('data-webhook');
        $('[data-bot-agent]').value = btn.getAttribute('data-agent') || '';
        $('[data-bot-enabled]').checked = btn.getAttribute('data-enabled') === '1';
        $('[data-bot-rotate]').checked = false;
        $('[data-bot-name-input]').focus();
      });
    });
    var saveBot = $('[data-bot-save]');
    if (saveBot) saveBot.addEventListener('click', function () {
      admin('bot-save', {
        id: $('[data-bot-id]').value.trim().toLowerCase(),
        name: $('[data-bot-name-input]').value.trim(),
        description: $('[data-bot-desc]').value.trim(),
        sort: Number($('[data-bot-sort]').value) || 100,
        webhook_url: $('[data-bot-hook]').value.trim(),
        agent_id: $('[data-bot-agent]').value.trim().toLowerCase(),
        enabled: $('[data-bot-enabled]').checked,
        rotate_webhook_key: $('[data-bot-rotate]').checked,
      }).then(reloadSoon);
    });
    $all('[data-webhook-key]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        admin('webhook-key', { bot_id: btn.getAttribute('data-webhook-key') }).then(function (data) {
          if (!data) return;
          $('[data-key-bot]').textContent = data.bot_id;
          $('[data-key-value]').textContent = data.key;
          var box = $('[data-key-result]');
          box.hidden = false;
          box.scrollIntoView({ block: 'center' });
        });
      });
    });

    // Tokens
    var mint = $('[data-token-mint]');
    if (mint) mint.addEventListener('click', function () {
      var days = Number($('[data-token-days]').value);
      admin('token-mint', {
        bot_id: $('[data-token-bot]').value,
        label: $('[data-token-label]').value.trim(),
        expires_days: days > 0 ? days : null,
      }).then(function (data) {
        if (!data) return;
        $('[data-token-value]').textContent = data.token;
        $('[data-token-env]').textContent = data.env_name;
        var box = $('[data-token-result]');
        box.hidden = false;
        box.scrollIntoView({ block: 'center' });
        say(statusEl, 'Token made. Copy it now; reload the page afterwards to see it in the list.', 'good');
      });
    });
    $all('[data-token-revoke]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.getAttribute('data-armed') !== '1') {
          btn.setAttribute('data-armed', '1');
          btn.textContent = 'Really revoke?';
          return;
        }
        admin('token-revoke', { token_id: btn.getAttribute('data-token-revoke') }).then(reloadSoon);
      });
    });

    // Publication decisions
    $all('[data-pub-decide]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var box = btn.closest('[data-pub]');
        admin('publication-decide', {
          id: box.getAttribute('data-pub'),
          decision: btn.getAttribute('data-pub-decide'),
          title: $('[data-pub-title]', box).value.trim(),
          slug: $('[data-pub-slug]', box).value.trim(),
          attribution: $('[data-pub-credit]', box).value.trim(),
          note: $('[data-pub-note]', box).value.trim(),
          attachment_ids: $all('[data-pub-file]:checked', box).map(function (c) { return c.value; }),
        }).then(reloadSoon);
      });
    });
    $all('[data-pub-url-save]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('[data-pub]');
        admin('publication-url', { id: row.getAttribute('data-pub'), public_url: $('[data-pub-url]', row).value.trim() });
      });
    });
  }

  // ---------------------------------------------------------------- start

  function guardPageDrops() {
    if (!document.querySelector('[data-composer]')) return;
    ['dragover', 'drop'].forEach(function (type) {
      window.addEventListener(type, function (e) {
        if (e.defaultPrevented) return;
        var types = e.dataTransfer && e.dataTransfer.types;
        if (types && Array.prototype.indexOf.call(types, 'Files') > -1) e.preventDefault();
      });
    });
  }

  function start() {
    guardPageDrops();
    $all('[data-composer]').forEach(setupComposer);
    var thread = $('[data-thread]');
    if (thread) setupThread(thread);
    if (document.body.getAttribute('data-page') === 'admin') setupAdmin();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
