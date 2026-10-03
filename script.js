(function () {
  'use strict';

  /* ============ settings ============ */
  const OWNER = 'uuhjeike', REPO = 'BMT-Homework', BRANCH = 'main';
  const RAW = 'https://raw.githubusercontent.com/' + OWNER + '/' + REPO + '/' + BRANCH + '/';

  // Each subject has a text file at the repo root: "<subject name>.txt"
  const SUBJECTS = [
    "বাংলা-১",
    "ইংরেজি-১",
    "কম্পিউটার অফিস অ্যাপ্লিকেশন-১",
    "ব্যবসায় গণিত ও পরিসংখ্যান",
    "হিসাববিজ্ঞান নীতি ও প্রয়োগ-১",
    "অর্থনীতি ও বাণিজ্যিক ভূগোল",
    "ব্যবসায় সংগঠন ও ব্যবস্থাপনা-১",
    "মার্কেটিং নীতি ও প্রয়োগ-১",
    "ডিজিটাল টেকনোলজি ইন বিজনেস-১",
    "হিউম্যান রিসোর্স ম্যানেজমেন্ট-১"
  ];

  const T = {
    homeTitle: 'হোমওয়ার্ক',
    homeSub: 'বিষয় বেছে নিন',
    back: '← সব বিষয়',
    loading: 'লোড হচ্ছে…',
    empty: 'এই বিষয়ে এখনো কোনো হোমওয়ার্ক দেওয়া হয়নি।',
    error: 'লোড করা যায়নি। ইন্টারনেট বা ফাইল চেক করুন।',
    retry: 'আবার চেষ্টা করুন',
    refresh: '↻ রিফ্রেশ',
    countSuffix: 'টি পোস্ট',
    piece: 'টি',
    end: 'সব পোস্ট দেখা হয়েছে',
    date: 'তারিখ',
    due: 'জমা',
    photos: 'ছবি',
    photoEnd: 'ছবি শেষ',
    video: 'ভিডিও',
    audio: 'অডিও চালান',
    viewFile: 'ফাইল দেখুন',
    openDrive: 'Drive-এ খুলুন ↗',
    imgFail: 'ছবি লোড হয়নি',
    openLink: '↗'
  };

  /* ============ helpers ============ */
  const $ = (s) => document.querySelector(s);
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function bn(x) {
    try { return Number(x).toLocaleString('bn-BD', { useGrouping: false }); }
    catch (e) { return String(x); }
  }

  /* ============ parsing ============ */
  const RE_DATE = /^(date|তারিখ)\s*[:：]\s*(.+)$/i;
  const RE_DUE = /^(due|জমা|জমার তারিখ|জমা দেওয়ার তারিখ|শেষ তারিখ)\s*[:：]\s*(.+)$/i;
  const PHOTO = /^(jpe?g|png|gif|webp|avif|bmp|svg)$/;
  const VIDEO = /^(mp4|webm|mov|m4v|ogv)$/;
  const AUDIO = /^(mp3|wav|m4a|aac|ogg|oga|opus|flac)$/;

  function extOf(url) {
    try {
      const p = decodeURIComponent(new URL(url).pathname);
      const m = /\.([a-z0-9]+)$/i.exec(p);
      return m ? m[1].toLowerCase() : '';
    } catch (e) { return ''; }
  }

  function classify(url) {
    let m = /(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i.exec(url);
    if (m) return { k: 'yt', url: url, id: m[1] };

    m = /drive\.google\.com\/file\/d\/([\w-]+)/i.exec(url) ||
        /drive\.google\.com\/(?:open|uc)\?(?:[^#\s]*&)?id=([\w-]+)/i.exec(url);
    if (m) return { k: 'drive', url: url, id: m[1] };

    // GitHub "blob" pages -> raw file, only when the file is a photo/video/audio
    let media = url;
    const gh = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:blob|raw)\/([^?#]+)/i.exec(url);
    if (gh) media = 'https://raw.githubusercontent.com/' + gh[1] + '/' + gh[2] + '/' + gh[3];

    const ext = extOf(media);
    if (PHOTO.test(ext)) return { k: 'photo', url: media };
    if (VIDEO.test(ext)) return { k: 'video', url: media };
    if (AUDIO.test(ext)) return { k: 'audio', url: media };

    let host = url;
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) {}
    return { k: 'link', url: url, host: host };
  }

  function tokenize(lines) {
    const out = [];
    let buf = [];
    const flush = () => {
      const s = buf.join('\n').replace(/\n{3,}/g, '\n\n').trim();
      if (s) out.push({ k: 'text', s: s });
      buf = [];
    };
    for (const raw of lines) {
      const t = raw.trim();
      if (/^https?:\/\/\S+$/i.test(t)) { flush(); out.push(classify(t)); }
      else buf.push(raw.replace(/\s+$/, ''));
    }
    flush();
    return out;
  }

  function parsePost(lines) {
    const meta = { date: '', due: '' };
    let i = 0;
    while (i < lines.length) {
      const t = lines[i].trim();
      if (!t) { i++; continue; }
      let m = RE_DATE.exec(t);
      if (m) { meta.date = m[2].trim(); i++; continue; }
      m = RE_DUE.exec(t);
      if (m) { meta.due = m[2].trim(); i++; continue; }
      break;
    }
    const blocks = tokenize(lines.slice(i));
    if (!blocks.length && !meta.date && !meta.due) return null;
    return { meta: meta, blocks: blocks };
  }

  // A post is wrapped between two lines that contain only "-"
  function parsePosts(text) {
    const lines = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
    const raw = [];
    let cur = [];
    for (const ln of lines) {
      if (ln.trim() === '-') { if (cur.length) raw.push(cur); cur = []; }
      else cur.push(ln);
    }
    if (cur.length) raw.push(cur);
    return raw.map(parsePost).filter(Boolean);   // file order kept: top of file = top of page
  }

  /* ============ loading ============ */
  const cache = new Map();

  async function getText(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  }

  async function loadSubject(idx, force) {
    if (!force && cache.has(idx)) return cache.get(idx);
    const file = encodeURIComponent(SUBJECTS[idx] + '.txt');
    const v = '?v=' + Math.floor(Date.now() / 60000) + (force ? '&r=' + Date.now() : '');
    let text;
    try { text = await getText(RAW + file + v); }
    catch (e) { text = await getText(file + v); }   // fallback: file next to index.html
    const posts = parsePosts(text);
    cache.set(idx, posts);
    return posts;
  }

  /* ============ popup (photos / video / audio / youtube / drive) ============ */
  const modal = $('#modal'), mBody = $('#mBody'), mCap = $('#mCap');
  const mPrev = $('#mPrev'), mNext = $('#mNext'), mClose = $('#mClose');
  let gallery = null;

  function openModal() {
    if (modal.hidden) {
      modal.hidden = false;
      document.body.classList.add('lock');
      history.pushState({ modal: 1 }, '');
    }
  }
  function hideModal() {
    modal.hidden = true;
    mBody.classList.remove('zoom');
    mBody.replaceChildren();          // removing the element stops any playback
    mCap.replaceChildren();
    mPrev.hidden = mNext.hidden = true;
    document.body.classList.remove('lock');
    gallery = null;
  }
  function closeModal() {
    if (modal.hidden) return;
    if (history.state && history.state.modal) history.back();
    else hideModal();
  }
  window.addEventListener('popstate', () => { if (!modal.hidden) hideModal(); });
  window.addEventListener('hashchange', () => { if (!modal.hidden) hideModal(); });
  mClose.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target === mBody) closeModal(); });

  function showPhoto(j) {
    gallery.idx = j;
    const img = new Image();
    img.className = 'm-img';
    img.alt = '';
    img.decoding = 'async';
    img.src = gallery.urls[j];
    img.addEventListener('click', () => mBody.classList.toggle('zoom'));
    mBody.classList.remove('zoom');
    mBody.replaceChildren(img);
    const many = gallery.urls.length > 1;
    mPrev.hidden = mNext.hidden = !many;
    mCap.textContent = many ? bn(j + 1) + ' / ' + bn(gallery.urls.length) : '';
  }
  function stepPhoto(d) {
    if (!gallery || gallery.urls.length < 2) return;
    const n = gallery.urls.length;
    showPhoto((gallery.idx + d + n) % n);
  }
  function openPhotos(urls, idx) {
    gallery = { urls: urls, idx: idx };
    showPhoto(idx);
    openModal();
  }
  mPrev.addEventListener('click', () => stepPhoto(-1));
  mNext.addEventListener('click', () => stepPhoto(1));

  let tx = null;
  mBody.addEventListener('touchstart', (e) => { tx = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  mBody.addEventListener('touchend', (e) => {
    if (tx == null || !gallery || mBody.classList.contains('zoom')) return;
    const dx = e.changedTouches[0].clientX - tx;
    tx = null;
    if (Math.abs(dx) > 60) stepPhoto(dx < 0 ? 1 : -1);
  }, { passive: true });

  document.addEventListener('keydown', (e) => {
    if (modal.hidden) return;
    if (e.key === 'Escape') closeModal();
    else if (e.key === 'ArrowLeft') stepPhoto(-1);
    else if (e.key === 'ArrowRight') stepPhoto(1);
  });

  function openVideo(url) {
    const v = document.createElement('video');
    v.className = 'm-media';
    v.controls = true; v.autoplay = true; v.playsInline = true;
    v.src = url;
    mBody.replaceChildren(v);
    openModal();
  }
  function openAudio(url) {
    const box = el('div', 'm-audio');
    const ic = el('i', null, '♪');
    const a = document.createElement('audio');
    a.controls = true; a.autoplay = true; a.src = url;
    box.append(ic, a);
    mBody.replaceChildren(box);
    openModal();
  }
  function openFrame(src, tall, capNode) {
    const f = document.createElement('iframe');
    f.className = 'm-frame' + (tall ? ' tall' : '');
    f.src = src;
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.allowFullscreen = true;
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    mBody.replaceChildren(f);
    mCap.replaceChildren();
    if (capNode) mCap.append(capNode);
    openModal();
  }
  function openYouTube(id) {
    openFrame('https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&playsinline=1', false);
  }
  function openDrive(b) {
    const a = el('a', null, T.openDrive);
    a.href = b.url; a.target = '_blank'; a.rel = 'noopener';
    openFrame('https://drive.google.com/file/d/' + b.id + '/preview', true, a);
  }

  /* ============ post rendering ============ */
  let videoIO = null;
  function lazyVideo(v) {
    if (typeof IntersectionObserver === 'undefined') { v.preload = 'metadata'; v.src = v.dataset.src; return; }
    if (!videoIO) {
      videoIO = new IntersectionObserver((entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          const v2 = en.target;
          videoIO.unobserve(v2);
          v2.preload = 'metadata';
          v2.src = v2.dataset.src;
        }
      }, { rootMargin: '400px 0px' });
    }
    videoIO.observe(v);
  }

  function renderText(s) {
    const d = el('div', 'txt');
    s.split(/(https?:\/\/[^\s]+)/g).forEach((part, i) => {
      if (!part) return;
      if (i % 2 === 0) { d.append(part); return; }
      let url = part, trail = '';
      const m = /[.,;:!?)\]'"»”’।]+$/.exec(url);
      if (m) { trail = m[0]; url = url.slice(0, url.length - trail.length); }
      const a = el('a', null, url);
      a.href = url; a.target = '_blank'; a.rel = 'noopener';
      d.append(a);
      if (trail) d.append(trail);
    });
    return d;
  }

  function buildStack(group) {
    const box = el('div', 'stack');
    const many = group.length > 1;
    if (many) box.append(el('div', 'stack-h', T.photos + ' · ' + bn(group.length) + T.piece));
    const urls = group.map((g) => g.url);
    group.forEach((g, j) => {
      const b = el('button', 'ph');
      b.type = 'button';
      b.setAttribute('aria-label', T.photos + ' ' + bn(j + 1));
      const img = document.createElement('img');
      img.loading = 'lazy'; img.decoding = 'async'; img.alt = '';
      img.src = g.url;
      img.addEventListener('error', () => {
        b.replaceChildren(el('div', 'ph-fail', T.imgFail));
        b.style.cursor = 'default';
        b.onclick = null;
      });
      b.append(img);
      if (many) b.append(el('span', 'idx', bn(j + 1) + '/' + bn(group.length)));
      b.addEventListener('click', () => { if (b.querySelector('img')) openPhotos(urls, j); });
      box.append(b);
    });
    if (many) box.append(el('div', 'stack-f', T.photoEnd));
    return box;
  }

  function playBadge() {
    const p = el('span', 'play');
    p.append(el('i', null, '▶'));
    return p;
  }
  function buildVideo(b) {
    const c = el('button', 'mcard');
    c.type = 'button';
    c.setAttribute('aria-label', T.video);
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'none';
    v.dataset.src = b.url + '#t=0.5';
    c.append(v, playBadge(), el('span', 'lbl', T.video));
    c.addEventListener('click', () => openVideo(b.url));
    lazyVideo(v);
    return c;
  }
  function buildYouTube(b) {
    const c = el('button', 'mcard');
    c.type = 'button';
    c.setAttribute('aria-label', 'YouTube');
    const img = document.createElement('img');
    img.loading = 'lazy'; img.alt = '';
    img.src = 'https://i.ytimg.com/vi/' + b.id + '/hqdefault.jpg';
    c.append(img, playBadge(), el('span', 'lbl', 'YouTube'));
    c.addEventListener('click', () => openYouTube(b.id));
    return c;
  }
  function buildAudio(b) {
    const c = el('button', 'acard');
    c.type = 'button';
    c.append(el('i', null, '▶'), el('span', null, T.audio));
    c.addEventListener('click', () => openAudio(b.url));
    return c;
  }
  function linkBtn(label, url) {
    const a = el('a', 'btn', label);
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    return a;
  }
  function buildButtons(group) {
    const row = el('div', 'btns');
    for (const b of group) {
      if (b.k === 'drive') {
        const v = el('button', 'btn', T.viewFile);
        v.type = 'button';
        v.addEventListener('click', () => openDrive(b));
        row.append(v, linkBtn(T.openDrive, b.url));
      } else {
        row.append(linkBtn(b.host + ' ' + T.openLink, b.url));
      }
    }
    return row;
  }

  function renderPost(p, number) {
    const item = el('div', 'item');
    const card = el('article', 'post');
    const head = el('div', 'post-head');
    head.append(el('span', 'num', '#' + bn(number)));
    if (p.meta.date) head.append(el('span', 'badge', T.date + ': ' + p.meta.date));
    if (p.meta.due) head.append(el('span', 'badge due', T.due + ': ' + p.meta.due));
    const body = el('div', 'post-body');
    const bl = p.blocks;
    let k = 0;
    while (k < bl.length) {
      const b = bl[k];
      if (b.k === 'photo') {
        const g = [];
        while (k < bl.length && bl[k].k === 'photo') g.push(bl[k++]);
        body.append(buildStack(g));
      } else if (b.k === 'drive' || b.k === 'link') {
        const g = [];
        while (k < bl.length && (bl[k].k === 'drive' || bl[k].k === 'link')) g.push(bl[k++]);
        body.append(buildButtons(g));
      } else {
        if (b.k === 'text') body.append(renderText(b.s));
        else if (b.k === 'video') body.append(buildVideo(b));
        else if (b.k === 'yt') body.append(buildYouTube(b));
        else if (b.k === 'audio') body.append(buildAudio(b));
        k++;
      }
    }
    card.append(head);
    if (body.childNodes.length) card.append(body);
    item.append(card);
    return item;
  }

  /* ============ windowed feed ============
     Only a window of posts is in the page. New posts are added as you
     scroll in either direction, and old ones are removed and replaced
     by an empty spacer of the same height, so the page stays light. */
  function Feed(posts, mount) {
    const n = posts.length;
    const CHUNK = 8, MAX = 24, NEAR = 1600, TRIM = 2600, EST = 320;
    const heights = new Array(n).fill(0);
    const topSp = el('div', 'spacer');
    const list = el('div', 'feed');
    const botSp = el('div', 'spacer');
    const endMark = el('div', 'endmark', T.end);
    endMark.hidden = true;
    mount.append(topSp, list, botSp, endMark);

    let start = 0, end = 0, dead = false, ticking = false;
    const els = new Map();
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver((entries) => {
          for (const e of entries) {
            const i = +e.target.dataset.i;
            if (e.target.offsetHeight) heights[i] = e.target.offsetHeight;
          }
        })
      : null;

    function avg() {
      let s = 0, c = 0;
      for (let i = 0; i < n; i++) if (heights[i]) { s += heights[i]; c++; }
      return c ? s / c : EST;
    }
    function sync() {
      const a = avg();
      let t = 0, b = 0;
      for (let i = 0; i < start; i++) t += heights[i] || a;
      for (let i = end; i < n; i++) b += heights[i] || a;
      topSp.style.height = t + 'px';
      botSp.style.height = b + 'px';
      endMark.hidden = end < n;
    }
    function make(i) {
      const e = renderPost(posts[i], n - i);   // newest (top of file) has the biggest number
      e.dataset.i = i;
      els.set(i, e);
      if (ro) ro.observe(e);
      return e;
    }
    function drop(i) {
      const e = els.get(i);
      if (!e) return;
      if (e.offsetHeight) heights[i] = e.offsetHeight;
      if (ro) ro.unobserve(e);
      els.delete(i);
      e.remove();
    }
    function clearAll() {
      for (const i of Array.from(els.keys())) drop(i);
    }

    function appendChunk() {
      const to = Math.min(end + CHUNK, n);
      const frag = document.createDocumentFragment();
      for (let i = end; i < to; i++) frag.append(make(i));
      list.append(frag);
      end = to;
      while (end - start > MAX) {
        const f = list.firstElementChild;
        if (!f || f.getBoundingClientRect().bottom > -TRIM) break;
        drop(start);
        start++;
      }
      sync();
    }
    function prependChunk() {
      const from = Math.max(start - CHUNK, 0);
      const anchor = list.firstElementChild;
      const before = anchor ? anchor.getBoundingClientRect().top : 0;
      const frag = document.createDocumentFragment();
      for (let i = from; i < start; i++) frag.append(make(i));
      list.insertBefore(frag, list.firstChild);
      start = from;
      while (end - start > MAX) {
        const l = list.lastElementChild;
        if (!l || l.getBoundingClientRect().top < window.innerHeight + TRIM) break;
        end--;
        drop(end);
      }
      sync();
      if (anchor) {
        const d = anchor.getBoundingClientRect().top - before;
        if (Math.abs(d) > 0.5) window.scrollBy(0, d);   // keep what you are reading in place
      }
    }
    // The scrollbar was dragged far away: rebuild the window around that spot
    function jump() {
      const feedTop = topSp.getBoundingClientRect().top + window.scrollY;
      const target = window.scrollY - feedTop;
      const a = avg();
      let acc = 0, i = 0;
      for (; i < n; i++) {
        const h = heights[i] || a;
        if (acc + h > target) break;
        acc += h;
      }
      i = Math.min(i, n - 1);
      const s = Math.max(0, i - CHUNK);
      clearAll();
      list.replaceChildren();
      start = end = s;
      sync();
    }

    function check() {
      ticking = false;
      if (dead) return;
      for (let g = 0; g < 10; g++) {
        const r = list.getBoundingClientRect();
        const vh = window.innerHeight;
        if (end > start && (r.bottom < -NEAR || r.top > vh + NEAR)) { jump(); continue; }
        if (end < n && r.bottom < vh + NEAR) { appendChunk(); continue; }
        if (start > 0 && r.top > -NEAR) { prependChunk(); continue; }
        break;
      }
    }
    function onScroll() {
      if (ticking || dead) return;
      ticking = true;
      requestAnimationFrame(check);
    }

    sync();
    check();
    return {
      onScroll: onScroll,
      destroy: function () {
        dead = true;
        if (ro) ro.disconnect();
        els.clear();
        mount.replaceChildren();
      }
    };
  }

  /* ============ pages ============ */
  const app = $('#app');
  const toTop = $('#toTop');
  let feed = null, token = 0;

  function teardown() {
    if (feed) { feed.destroy(); feed = null; }
  }

  function showHome() {
    teardown();
    token++;
    document.title = 'BMT Homework';
    const root = el('section', 'home');
    const hero = el('div', 'hero');
    hero.append(el('h1', null, T.homeTitle), el('p', null, T.homeSub));
    const ul = el('ul', 'tiles');
    SUBJECTS.forEach((name, i) => {
      const li = el('li');
      const a = el('a', 'tile');
      a.href = '#/s/' + (i + 1);
      a.append(el('span', 'no', bn(i + 1)), el('span', 'nm', name), el('span', 'ch', '›'));
      li.append(a);
      ul.append(li);
    });
    root.append(hero, ul);
    app.replaceChildren(root);
    window.scrollTo(0, 0);
  }

  async function openSubject(idx, force) {
    teardown();
    const my = ++token;
    document.title = SUBJECTS[idx] + ' · BMT Homework';

    const root = el('section', 'subject');
    const head = el('div', 'sub-head');
    const back = el('a', 'back', T.back);
    back.href = '#/';
    const bar = el('div', 'sub-bar');
    const count = el('span', 'count', '');
    const rf = el('button', 'btn small', T.refresh);
    rf.type = 'button';
    rf.addEventListener('click', () => openSubject(idx, true));
    bar.append(count, rf);
    head.append(back, el('h1', null, SUBJECTS[idx]), bar);
    const status = el('div', 'status', T.loading);
    const mount = el('div', 'feed-mount');
    root.append(head, status, mount);
    app.replaceChildren(root);
    window.scrollTo(0, 0);

    try {
      const posts = await loadSubject(idx, force);
      if (my !== token) return;
      count.textContent = bn(posts.length) + T.countSuffix;
      if (!posts.length) { status.textContent = T.empty; return; }
      status.remove();
      feed = Feed(posts, mount);
    } catch (e) {
      if (my !== token) return;
      status.textContent = T.error;
      const r = el('button', 'btn', T.retry);
      r.type = 'button';
      r.addEventListener('click', () => openSubject(idx, true));
      status.append(el('br'), r);
    }
  }

  function route() {
    const m = /^#\/s\/(\d+)$/.exec(location.hash);
    const idx = m ? +m[1] - 1 : -1;
    if (idx >= 0 && idx < SUBJECTS.length) openSubject(idx, false);
    else showHome();
  }
  window.addEventListener('hashchange', route);

  window.addEventListener('scroll', () => {
    toTop.hidden = window.scrollY < 800;
    if (feed) feed.onScroll();
  }, { passive: true });
  window.addEventListener('resize', () => { if (feed) feed.onScroll(); });
  toTop.addEventListener('click', () => window.scrollTo(0, 0));

  route();
})();
