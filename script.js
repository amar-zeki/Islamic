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
        'الفاتحة','البقرة','آل عمران','النساء','المائدة',
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

    // ── Theme ──
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

    // ── Recitation Style ──
    recitationStyle.addEventListener('change', () => {
        reciterStyleSpan.textContent = recitationStyle.options[recitationStyle.selectedIndex].text.split(' ')[0];
        if (currentJuz !== null) {
            const prevKey = playlist[currentIndex]?.verse_key;
            const wasPlaying = !audio.paused;
            audio.pause();
            loadAudioForJuz(currentJuz).then(() => {
                // Re-map URLs in playlist
                playlist = playlist.map(v => ({ ...v, url: audioDataMap[v.verse_key] || null }));
                if (prevKey) {
                    const newIdx = playlist.findIndex(v => v.verse_key === prevKey);
                    if (newIdx !== -1) loadTrack(newIdx, wasPlaying);
                }
            });
        }
    });

    // ── Mobile Menu ──
    function toggleMenu() {
        sidebar.classList.toggle('open');
        backdrop.classList.toggle('show');
    }
    menuToggle.addEventListener('click', toggleMenu);
    backdrop.addEventListener('click', toggleMenu);

    // ── Build Juz Sidebar ──
    for (let i = 1; i <= 30; i++) {
        const li = document.createElement('li');
        li.className = 'juz-item';
        li.dataset.juz = i;
        li.innerHTML = `<span class="juz-number">${i}</span><span class="juz-name">Juz ${i}</span>`;
        li.addEventListener('click', () => loadJuz(i, li));
        juzList.appendChild(li);
    }

    // ── Fetch Audio URLs for a Juz (all pages) ──
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

    // ── Load a Juz ──
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
            }));

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

    // ── Arabic numeral converter ──
    function toArabicNumeral(n) {
        return n.toString().split('').map(c => '٠١٢٣٤٥٦٧٨٩'[+c] ?? c).join('');
    }

    // ── Render Mushaf Page View ──
    function renderPage(verses) {
        const page = document.createElement('div');
        page.className = 'quran-page';

        let lastSurah = null;

        verses.forEach((verse, idx) => {
            const [surahNum, ayahNum] = verse.verse_key.split(':');

            // ── Surah header when surah changes ──
            if (surahNum !== lastSurah) {
                // Surah banner
                const header = document.createElement('div');
                header.className = 'surah-header-page';
                const sName = SURAH_NAMES[+surahNum] || '';
                header.textContent = `سورة ${sName}  (${surahNum})`;
                page.appendChild(header);

                // Bismillah for every surah except Al-Tawbah (9) and Al-Fatiha
                // (Al-Fatiha's verse 1 IS the bismillah; other surahs get one before their first verse)
                if (surahNum !== '9' && surahNum !== '1') {
                    const bismi = document.createElement('span');
                    bismi.className = 'bismillah-page';
                    bismi.textContent = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';
                    page.appendChild(bismi);
                }

                lastSurah = surahNum;
            }

            // ── Inline verse span ──
            const span = document.createElement('span');
            span.className = 'verse-inline';
            span.dataset.index = idx;
            span.title = `Surah ${surahNum}:${ayahNum} — click to play`;

            span.innerHTML = `${verse.text_uthmani}<span class="verse-ender">\uFD3E${toArabicNumeral(ayahNum)}\uFD3F</span>`;

            span.addEventListener('click', () => playFromIndex(idx));
            page.appendChild(span);

            // small space between verses so text breathes
            page.appendChild(document.createTextNode(' '));
        });

        contentArea.appendChild(page);
        contentArea.scrollTop = 0;
    }

    // ── Play from a given index ──
    function playFromIndex(idx) {
        currentIndex = idx;
        loadTrack(idx, true);
    }

    // ── Highlight helpers ──
    function clearPlaying() {
        document.querySelectorAll('.verse-inline.playing').forEach(el => el.classList.remove('playing'));
    }

    // ── Load & optionally play a track ──
    function loadTrack(idx, autoPlay = false) {
        if (idx < 0 || idx >= playlist.length) return;
        const verse = playlist[idx];

        if (!verse.url) {
            if (autoPlay && isAutoPlay && idx + 1 < playlist.length) playFromIndex(idx + 1);
            return;
        }

        // Highlight verse in page
        clearPlaying();
        const activeSpan = document.querySelector(`.verse-inline[data-index="${idx}"]`);
        if (activeSpan) {
            activeSpan.classList.add('playing');
            setTimeout(() => activeSpan.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
        }

        // Update player bar
        const [surahNum, ayahNum] = verse.verse_key.split(':');
        playerVerseKey.textContent = `${SURAH_NAMES[+surahNum] || 'Surah ' + surahNum}  •  آية ${toArabicNumeral(+ayahNum)}`;
        playerVerseText.textContent = verse.text_uthmani;

        // Load audio
        audio.src = AUDIO_BASE + verse.url;
        audio.load();
        showPlayer();

        if (autoPlay) audio.play().catch(e => console.error('Playback error:', e));
        currentIndex = idx;
    }

    // ── Player visibility ──
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

    // ── Audio events ──
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

    // ── Progress bar seek ──
    progressBarContainer.addEventListener('click', (e) => {
        const rect = progressBarContainer.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        if (audio.duration) audio.currentTime = ratio * audio.duration;
    });

    // ── Controls ──
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

    // ── Volume ──
    volumeSlider.addEventListener('input', () => {
        audio.volume = parseFloat(volumeSlider.value);
        volumeIcon.textContent = audio.volume === 0 ? '🔇' : audio.volume < 0.5 ? '🔉' : '🔊';
    });

    volumeIcon.addEventListener('click', () => {
        if (audio.volume > 0) { audio.volume = 0; volumeSlider.value = 0; volumeIcon.textContent = '🔇'; }
        else                  { audio.volume = 1; volumeSlider.value = 1; volumeIcon.textContent = '🔊'; }
    });

    // ── Keyboard shortcuts ──
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        switch (e.code) {
            case 'Space':      e.preventDefault(); if (currentIndex !== -1) audio.paused ? audio.play() : audio.pause(); break;
            case 'ArrowRight': e.preventDefault(); if (currentIndex < playlist.length - 1) playFromIndex(currentIndex + 1); break;
            case 'ArrowLeft':  e.preventDefault(); if (currentIndex > 0) playFromIndex(currentIndex - 1); break;
            case 'KeyR':       btnRepeat.click(); break;
        }
    });

    // ── Utility ──
    function formatTime(secs) {
        if (isNaN(secs)) return '0:00';
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

});
