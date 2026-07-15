document.addEventListener('DOMContentLoaded', () => {

    // ── DOM References ──
    const juzList          = document.getElementById('juzList');
    const contentArea      = document.getElementById('contentArea');
    const currentJuzTitle  = document.getElementById('currentJuzTitle');
    const loader           = document.getElementById('loader');
    const menuToggle       = document.getElementById('menuToggle');
    const sidebar          = document.getElementById('sidebar');
    const backdrop         = document.getElementById('backdrop');
    const themeToggle      = document.getElementById('themeToggle');
    const recitationStyle  = document.getElementById('recitationStyle');
    const reciterStyleSpan = document.getElementById('reciterStyle');
    const searchOverlay    = document.getElementById('searchOverlay');
    const searchInput      = document.getElementById('searchInput');
    const searchClose      = document.getElementById('searchClose');
    const searchResults    = document.getElementById('searchResults');
    const sidebarSearchBtn = document.getElementById('sidebarSearchBtn');
    const topSearchBtn     = document.getElementById('topSearchBtn');
    const welcomeSearchBtn = document.getElementById('welcomeSearchBtn');

    // Audio Player DOM
    const audioPlayer          = document.getElementById('audioPlayer');
    const btnPlayPause         = document.getElementById('btnPlayPause');
    const btnPrev              = document.getElementById('btnPrev');
    const btnNext              = document.getElementById('btnNext');
    const btnRepeat            = document.getElementById('btnRepeat');
    const btnAutoPlay          = document.getElementById('btnAutoPlay');
    const btnClose             = document.getElementById('btnClose');
    const iconPlay             = document.getElementById('iconPlay');
    const iconPause            = document.getElementById('iconPause');
    const progressFill         = document.getElementById('progressFill');
    const progressThumb        = document.getElementById('progressThumb');
    const progressBarContainer = document.getElementById('progressBarContainer');
    const timeCurrentDisplay   = document.getElementById('timeCurrentDisplay');
    const timeDurationDisplay  = document.getElementById('timeDurationDisplay');
    const volumeSlider         = document.getElementById('volumeSlider');
    const volumeIcon           = document.getElementById('volumeIcon');
    const playerVerseKey       = document.getElementById('playerVerseKey');
    const playerVerseText      = document.getElementById('playerVerseText');

    // ── Audio State ──
    const audio      = new Audio();
    let playlist     = [];       // [{verse_key, url, text_uthmani}, ...]
    let currentIndex = -1;
    let isRepeat     = false;
    let isAutoPlay   = true;
    let currentJuz   = null;
    let audioDataMap = {};       // verse_key → relative url
    const AUDIO_BASE = 'https://verses.quran.com/';

    // ── All 114 Surah names (Arabic) ──
    const SURAH_NAMES = [
        '',
        'الفاتحة','البقرة','آل عمران','النساء','المائة',
        'الأنعام','الأعراف','الأنفال','التوبة','يونس',
        'هود','يوسف','الرعد','إبراهيم','الحجر',
        'النحل','الإسراء','الكهف','مريم','طه',
        'الأنبياء','الحج','المؤمنون','النور','الفرقان',
        'الشعراء','النمل','القصص','العنكبوت','الروم',
        'لقمان','السجدة','الأحزاب','سبأ','فاطر',
        'يس','الصافات','ص','الزمر','غافر',
        'فصلت','الشورى','الزخرف','الدخان','الجاثية',
        'الأحقاف','محمد','الفتح','الحجرات','ق',
        'الذاريات','الطور','النجم','القمر','الرحمن',
        'الواقعة','الحديد','المجادلة','الحشر','الممتحنة',
        'الصف','الجمعة','المنافقون','التغابن','الطلاق',
        'التحريم','الملك','القلم','الحاقة','المعارج',
        'نوح','الجن','المزمل','المدثر','القيامة',
        'الإنسان','المرسلات','النبأ','النازعات','عبس',
        'التكوير','الانفطار','المطففين','الانشقاق','البروج',
        'الطارق','الأعلى','الغاشية','الفجر','البلد',
        'الشمس','الليل','الضحى','الشرح','التين',
        'العلق','القدر','البينة','الزلزلة','العاديات',
        'القارعة','التكاثر','العصر','الهمزة','الفيل',
        'قريش','الماعون','الكوثر','الكافرون','النصر',
        'المسد','الإخلاص','الفلق','الناس'
    ];

    // ── Theme handling ──
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    } else if (window.matchMedia?.('(prefers-color-scheme: light)').matches) {
        document.documentElement.setAttribute('data-theme', 'light');
    }
    themeToggle.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
    });

    // ── Recitation style handling ──
    recitationStyle.addEventListener('change', () => {
        reciterStyleSpan.textContent = recitationStyle.options[recitationStyle.selectedIndex].text.split(' ')[0];
        if (currentJuz !== null) {
            const prevKey = playlist[currentIndex]?.verse_key;
            const wasPlaying = !audio.paused;
            audio.pause();
            loadAudioForJuz(currentJuz).then(() => {
                playlist = playlist.map(v => ({ ...v, url: audioDataMap[v.verse_key] || null }));
                if (prevKey) {
                    const newIdx = playlist.findIndex(v => v.verse_key === prevKey);
                    if (newIdx !== -1) loadTrack(newIdx, wasPlaying);
                }
            });
        }
    });

    // ── Mobile menu toggle ──
    function toggleMenu() {
        sidebar.classList.toggle('open');
        backdrop.classList.toggle('show');
    }
    menuToggle.addEventListener('click', toggleMenu);
    backdrop.addEventListener('click', toggleMenu);

    // ── Build Juz sidebar with Surah sub‑menus ──
    const juzItemsMap = {};
    for (let i = 1; i <= 30; i++) {
        const li = document.createElement('li');
        li.className = 'juz-item';
        li.dataset.juz = i;
        const numSpan = document.createElement('span');
        numSpan.className = 'juz-number';
        numSpan.textContent = i;
        li.appendChild(numSpan);
        const labelSpan = document.createElement('span');
        labelSpan.className = 'juz-name';
        labelSpan.textContent = `Juz ${i}`;
        li.appendChild(labelSpan);
        const toggleSpan = document.createElement('span');
        toggleSpan.className = 'juz-toggle';
        toggleSpan.textContent = '▸';
        li.appendChild(toggleSpan);
        const surahUl = document.createElement('ul');
        surahUl.className = 'surah-list';
        surahUl.style.display = 'none';
        li.appendChild(surahUl);
        li.addEventListener('click', (e) => {
            if (e.target === toggleSpan) return;
            loadJuz(i, li);
        });
        toggleSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            const visible = surahUl.style.display === 'block';
            surahUl.style.display = visible ? 'none' : 'block';
            toggleSpan.textContent = visible ? '▸' : '▾';
        });
        juzList.appendChild(li);
        juzItemsMap[i] = { li, surahUl };
    }

    // Map Surah → Juz
    const surahToJuz = {};

    // ── Fetch audio URLs for a Juz (all pages) ──
    async function loadAudioForJuz(juzNumber) {
        audioDataMap = {};
        const recId = recitationStyle.value;
        let page = 1, totalPages = 1;
        while (page <= totalPages) {
            const res  = await fetch(`https://api.quran.com/api/v4/recitations/${recId}/by_juz/${juzNumber}?per_page=300&page=${page}`);
            const data = await res.json();
            totalPages = data.pagination?.total_pages || 1;
            data.audio_files.forEach(f => { audioDataMap[f.verse_key] = f.url; });
            page++;
        }
    }

    // ── Load a Juz (and its Surah submenu) ──
    async function loadJuz(juzNumber, listItem) {
        document.querySelectorAll('.juz-item').forEach(i => i.classList.remove('active'));
        if (listItem) listItem.classList.add('active');
        else document.querySelector(`.juz-item[data-juz="${juzNumber}"]`)?.classList.add('active');
        if (sidebar.classList.contains('open')) toggleMenu();
        currentJuzTitle.textContent = `Juz ${juzNumber}`;
        currentJuz = juzNumber;
        loader.classList.remove('hidden');
        contentArea.innerHTML = '';
        try {
            const [versesData] = await Promise.all([
                fetch(`https://api.quran.com/api/v4/quran/verses/uthmani?juz_number=${juzNumber}&per_page=300`).then(r => r.json()),
                loadAudioForJuz(juzNumber)
            ]);
            playlist = versesData.verses.map(v => ({
                verse_key:    v.verse_key,
                url:          audioDataMap[v.verse_key] || null,
                text_uthmani: v.text_uthmani,
                surah_num:    +v.verse_key.split(':')[0]
            }));
            // Build Surah submenu for this Juz
            const surahSet = new Set(playlist.map(v => v.surah_num));
            const { surahUl } = juzItemsMap[juzNumber];
            surahUl.innerHTML = '';
            surahSet.forEach(sNum => {
                const sLi = document.createElement('li');
                sLi.className = 'surah-item';
                sLi.dataset.surah = sNum;
                sLi.dataset.juz = juzNumber;
                sLi.textContent = `${SURAH_NAMES[sNum]} (${sNum})`;
                sLi.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const header = document.querySelector(`.surah-header-page[data-surah="${sNum}"]`);
                    if (header) header.scrollIntoView({ behavior: 'smooth', block: 'center' });
                });
                surahUl.appendChild(sLi);
                if (!surahToJuz[sNum]) surahToJuz[sNum] = juzNumber;
            });
            renderPage(playlist);
        } catch (err) {
            console.error(err);
            contentArea.innerHTML = `
                <div class="welcome-screen">
                    <div class="icon-quran">⚠️</div>
                    <h2>Error Loading Data</h2>
                    <p>Please check your internet connection and try again.</p>
                </div>`;
        } finally {
            loader.classList.add('hidden');
        }
    }

    // ── Arabic numeral helper ──
    function toArabicNumeral(n) {
        return n.toString().split('').map(c => '٠١٢٣٤٥٦٧٨٩'[+c] ?? c).join('');
    }

    // ── Render page view (Mushaf style) ──
    function renderPage(verses) {
        const page = document.createElement('div');
        page.className = 'quran-page';
        let lastSurah = null;
        verses.forEach((verse, idx) => {
            const [surahNum, ayahNum] = verse.verse_key.split(':');
            if (surahNum !== lastSurah) {
                const header = document.createElement('div');
                header.className = 'surah-header-page';
                header.dataset.surah = surahNum;
                const sName = SURAH_NAMES[+surahNum] || '';
                header.textContent = `سورة ${sName}  (${surahNum})`;
                page.appendChild(header);
                if (surahNum !== '9' && surahNum !== '1') {
                    const bismi = document.createElement('span');
                    bismi.className = 'bismillah-page';
                    bismi.textContent = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱלרַחִيمִ';
                    page.appendChild(bismi);
                }
                lastSurah = surahNum;
            }
            const span = document.createElement('span');
            span.className = 'verse-inline';
            span.dataset.index = idx;
            span.title = `Surah ${surahNum}:${ayahNum} — click to play`;
            span.innerHTML = `${verse.text_uthmani}<span class="verse-ender">\uFD3E${toArabicNumeral(ayahNum)}\uFD3F</span>`;
            span.addEventListener('click', () => playFromIndex(idx));
            page.appendChild(span);
            page.appendChild(document.createTextNode(' '));
        });
        contentArea.appendChild(page);
        contentArea.scrollTop = 0;
    }

    // ── Play a specific index ──
    function playFromIndex(idx) {
        currentIndex = idx;
        loadTrack(idx, true);
    }

    // ── Highlight handling ──
    function clearPlaying() {
        document.querySelectorAll('.verse-inline.playing').forEach(el => el.classList.remove('playing'));
    }

    // ── Load a track and optionally autoplay ──
    function loadTrack(idx, autoPlay = false) {
        if (idx < 0 || idx >= playlist.length) return;
        const verse = playlist[idx];
        if (!verse.url) {
            if (autoPlay && isAutoPlay && idx + 1 < playlist.length) playFromIndex(idx + 1);
            return;
        }
        clearPlaying();
        const activeSpan = document.querySelector(`.verse-inline[data-index="${idx}"]`);
        if (activeSpan) {
            activeSpan.classList.add('playing');
            setTimeout(() => activeSpan.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
        }
        const [surahNum, ayahNum] = verse.verse_key.split(':');
        playerVerseKey.textContent = `${SURAH_NAMES[+surahNum] || 'Surah ' + surahNum}  •  آية ${toArabicNumeral(+ayahNum)}`;
        playerVerseText.textContent = verse.text_uthmani;
        audio.src = AUDIO_BASE + verse.url;
        audio.load();
        showPlayer();
        if (autoPlay) audio.play().catch(e => console.error('Playback error:', e));
        currentIndex = idx;
    }

    // ── Player UI helpers ──
    function showPlayer() {
        audioPlayer.classList.remove('hidden');
        contentArea.classList.add('player-open');
    }
    function hidePlayer() {
        audioPlayer.classList.add('hidden');
        contentArea.classList.remove('player-open');
        audio.pause();
        clearPlaying();
    }

    // ── Audio event listeners ──
    audio.addEventListener('play', () => {
        iconPlay.classList.add('hidden');
        iconPause.classList.remove('hidden');
    });
    audio.addEventListener('pause', () => {
        iconPlay.classList.remove('hidden');
        iconPause.classList.add('hidden');
    });
    audio.addEventListener('ended', () => {
        if (isRepeat) {
            audio.play();
        } else if (isAutoPlay && currentIndex < playlist.length - 1) {
            playFromIndex(currentIndex + 1);
        } else {
            iconPlay.classList.remove('hidden');
            iconPause.classList.add('hidden');
            clearPlaying();
        }
    });
    audio.addEventListener('timeupdate', () => {
        if (!audio.duration) return;
        const pct = (audio.currentTime / audio.duration) * 100;
        progressFill.style.width = pct + '%';
        progressThumb.style.left = pct + '%';
        timeCurrentDisplay.textContent = formatTime(audio.currentTime);
    });
    audio.addEventListener('loadedmetadata', () => {
        timeDurationDisplay.textContent = formatTime(audio.duration);
    });
    audio.addEventListener('error', () => {
        if (isAutoPlay && currentIndex < playlist.length - 1) {
            setTimeout(() => playFromIndex(currentIndex + 1), 400);
        }
    });
    // Seek bar
    progressBarContainer.addEventListener('click', (e) => {
        const rect = progressBarContainer.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        if (audio.duration) audio.currentTime = ratio * audio.duration;
    });
    // Controls
    btnPlayPause.addEventListener('click', () => {
        if (currentIndex === -1 && playlist.length > 0) { playFromIndex(0); return; }
        audio.paused ? audio.play() : audio.pause();
    });
    btnPrev.addEventListener('click', () => {
        if (audio.currentTime > 3) { audio.currentTime = 0; }
        else if (currentIndex > 0) playFromIndex(currentIndex - 1);
    });
    btnNext.addEventListener('click', () => {
        if (currentIndex < playlist.length - 1) playFromIndex(currentIndex + 1);
    });
    btnRepeat.addEventListener('click', () => {
        isRepeat = !isRepeat;
        btnRepeat.classList.toggle('active', isRepeat);
        btnRepeat.title = isRepeat ? 'Repeat: ON' : 'Repeat verse';
    });
    btnAutoPlay.addEventListener('click', () => {
        isAutoPlay = !isAutoPlay;
        btnAutoPlay.classList.toggle('active', isAutoPlay);
        btnAutoPlay.title = isAutoPlay ? 'Auto-play: ON' : 'Auto-play: OFF';
    });
    btnClose.addEventListener('click', hidePlayer);

    // ── Volume controls ──
    volumeSlider.addEventListener('input', () => {
        audio.volume = parseFloat(volumeSlider.value);
        volumeIcon.textContent = audio.volume === 0 ? '🔇' : audio.volume < 0.5 ? '🔉' : '🔊';
    });
    volumeIcon.addEventListener('click', () => {
        if (audio.volume > 0) { audio.volume = 0; volumeSlider.value = 0; volumeIcon.textContent = '🔇'; }
        else { audio.volume = 1; volumeSlider.value = 1; volumeIcon.textContent = '🔊'; }
    });

    // ── Search overlay handling ──
    function openSearch() {
        searchOverlay.classList.add('open');
        searchInput.value = '';
        searchResults.innerHTML = '';
        searchInput.focus();
    }
    function closeSearch() {
        searchOverlay.classList.remove('open');
    }
    sidebarSearchBtn.addEventListener('click', openSearch);
    topSearchBtn.addEventListener('click', openSearch);
    if (welcomeSearchBtn) welcomeSearchBtn.addEventListener('click', openSearch);
    searchClose.addEventListener('click', closeSearch);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchOverlay.classList.contains('open')) closeSearch();
    });

    // Simple debounce helper
    function debounce(fn, delay) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    // Search execution (Juz, Surah, text)
    const performSearch = debounce(() => {
        const query = searchInput.value.trim();
        if (!query) { searchResults.innerHTML = ''; return; }
        // Numeric Juz search
        const juzNum = parseInt(query.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(juzNum) && juzNum >= 1 && juzNum <= 30) {
            const li = document.querySelector(`.juz-item[data-juz="${juzNum}"]`);
            if (li) li.click();
            closeSearch();
            return;
        }
        // Surah name (Arabic) search
        const surahIdx = SURAH_NAMES.findIndex(name => name && name.includes(query));
        if (surahIdx > 0) {
            const targetJuz = surahToJuz[surahIdx];
            if (targetJuz && targetJuz !== currentJuz) {
                const li = document.querySelector(`.juz-item[data-juz="${targetJuz}"]`);
                if (li) li.click();
                setTimeout(() => {
                    const hdr = document.querySelector(`.surah-header-page[data-surah="${surahIdx}"]`);
                    if (hdr) hdr.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 500);
            } else {
                const hdr = document.querySelector(`.surah-header-page[data-surah="${surahIdx}"]`);
                if (hdr) hdr.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            closeSearch();
            return;
        }
        // Text search inside verses
        const results = [];
        playlist.forEach((v, i) => {
            if (v.text_uthmani.includes(query)) {
                results.push({ index: i, verse_key: v.verse_key, snippet: v.text_uthmani.replace(query, `<mark>${query}</mark>`) });
            }
        });
        if (results.length === 0) {
            searchResults.innerHTML = '<p class="no-results">No matches found.</p>';
            return;
        }
        const fragment = document.createDocumentFragment();
        results.slice(0,20).forEach(r => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.innerHTML = `<div class="result-key">${r.verse_key}</div><div class="result-text">${r.snippet}</div>`;
            div.addEventListener('click', () => {
                playFromIndex(r.index);
                closeSearch();
            });
            fragment.appendChild(div);
        });
        searchResults.innerHTML = '';
        searchResults.appendChild(fragment);
    }, 300);
    searchInput.addEventListener('input', performSearch);

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        switch (e.code) {
            case 'Space':      e.preventDefault(); if (currentIndex !== -1) audio.paused ? audio.play() : audio.pause(); break;
            case 'ArrowRight': e.preventDefault(); if (currentIndex < playlist.length - 1) playFromIndex(currentIndex + 1); break;
            case 'ArrowLeft':  e.preventDefault(); if (currentIndex > 0) playFromIndex(currentIndex - 1); break;
            case 'KeyR':       btnRepeat.click(); break;
            case 'KeyF':       openSearch(); break;
        }
    });

    // Time formatting utility
    function formatTime(secs) {
        if (isNaN(secs)) return '0:00';
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    // Load first Juz on startup
    loadJuz(1);
});
