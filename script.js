// ADMOB CONFIGURATION (For Android WebView Integration)
const AdConfig = {
    bannerId: "ca-app-pub-8153155435482394/4124080128", // Real banner ad
    rewardId: "ca-app-pub-8153155435482394/8202393104", // Real rewarded ad
    position: "BOTTOM_CENTER",
    // The Android wrapper code should listen for 'DOMContentLoaded',
    // then find #admob-banner-container and attach the native AdView there.
};

const AudioController = {
    ctx: null,
    sfxMuted: false,
    musicEnabled: false,
    isPlayingBgm: false,
    bgmTimer: null,
    currentTrack: 'menu',
    voices: [],

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();

        if ('speechSynthesis' in window) {
            this.voices = window.speechSynthesis.getVoices();
            window.speechSynthesis.onvoiceschanged = () => {
                this.voices = window.speechSynthesis.getVoices();
            };
        }
    },

    playTone(freq, type, duration, vol = 0.1, ramp = true) {
        if (this.sfxMuted || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        if (ramp) gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },

    playMusicTone(freq, type, duration, vol = 0.1) {
        if (!this.musicEnabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },

    playPop() { this.playTone(800 + Math.random() * 200, 'sine', 0.1, 0.1); },
    playBonus() { [1200, 1500, 2000].forEach((freq, i) => { setTimeout(() => this.playTone(freq, 'sine', 0.4, 0.08), i * 60); }); },
    playMiss() { this.playTone(100, 'sawtooth', 0.2, 0.1); },
    playExplosion() {
        this.playTone(50, 'sawtooth', 0.5, 0.4);
        this.playTone(80, 'square', 0.3, 0.3);
    },
    playDamage() {
        this.playTone(300, 'sawtooth', 0.1, 0.3);
        this.playTone(100, 'square', 0.2, 0.2);
    },
    playGameOver() { this.playTone(150, 'sawtooth', 0.5, 0.15); },

    playGhostWhisper() {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); 
            const utter = new SpeechSynthesisUtterance("Hay"); 
            const femaleVoice = this.voices.find(v => 
                v.name.includes('Google US English') || 
                v.name.includes('Zira') || 
                v.name.includes('Samantha') || 
                v.name.toLowerCase().includes('female')
            );
            if (femaleVoice) { utter.voice = femaleVoice; utter.pitch = 1.2; } 
            else { utter.pitch = 1.6; }
            utter.rate = 0.4; utter.volume = 1.0; 
            window.speechSynthesis.speak(utter);
        }
    },

    startMusic(track) {
        this.currentTrack = track;
        if(!this.musicEnabled || !this.ctx) { this.stopBGM(); return; }
        this.stopBGM(); 
        this.isPlayingBgm = true;
        if (track === 'menu') this.menuLoop(0);
        else if (track === 'game') this.gameLoop();
    },

    stopBGM() { this.isPlayingBgm = false; clearTimeout(this.bgmTimer); },

    menuLoop(step) {
        if (!this.isPlayingBgm || this.currentTrack !== 'menu') return;
        const bassNotes = [130.81, 164.81, 196.00, 220.00];
        this.playMusicTone(bassNotes[step % 4], 'triangle', 0.3, 0.15); 
        const melody = [523.25, null, 659.25, null, 783.99, 880.00, 783.99, null];
        const note = melody[step % 8];
        if (note) setTimeout(() => { if (this.isPlayingBgm) this.playMusicTone(note, 'sine', 0.4, 0.05); }, 0); 
        this.bgmTimer = setTimeout(() => this.menuLoop(step + 1), 250); 
    },

    gameLoop() {
        if (!this.isPlayingBgm || this.currentTrack !== 'game') return;
        this.playMusicTone(100, 'sine', 0.4, 0.1);
        setTimeout(() => { if(this.isPlayingBgm) this.playMusicTone(3000, 'sine', 0.05, 0.02); }, 200); 
        this.bgmTimer = setTimeout(() => this.gameLoop(), 1000);
    }
};

const DotDash = {
    state: {
        score: 0,
        timeLeft: 100,
        isPlaying: false,
        isPaused: false,
        currentMode: 'classic',
        dotSpeed: 1500,
        combo: 0,
        hasRevived: false,
        totalSpawns: parseInt(localStorage.getItem('dotDashTotalSpawns')) || 0,
        bestClassic: parseInt(localStorage.getItem('dotDashBestClassic')) || 0,
        bestFrenzy: parseInt(localStorage.getItem('dotDashBestFrenzy')) || 0,
        bestMemory: parseInt(localStorage.getItem('dotDashBestMemory')) || 0,
        memorySequence: [],
        playerStep: 0,
        isPlayerTurn: false,
    },

    config: {
        INITIAL_TIME: 100,
        DECAY_CLASSIC: 0.22,
        DECAY_FRENZY: 0.38,
        TIME_REGAIN: 6,
        CLASSIC_ACCEL: 0.93,
        GHOST_TRIGGER: 1000
    },

    memoryColors: [
        { id: 0, color: '#ef4444' }, // Red
        { id: 1, color: '#3b82f6' }, // Blue
        { id: 2, color: '#eab308' }, // Yellow
        { id: 3, color: '#22c55e' }, // Green
        { id: 4, color: '#f97316' }, // Orange
        { id: 5, color: '#a855f7' }, // Purple
        { id: 6, color: '#ec4899' }, // Pink
        { id: 7, color: '#64748b' }  // Gray
    ],

    timers: {
        game: null,
        spawn: null,
        frenzy: null,
        memory: null
    },

    dom: {},

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.updatePersonalBests();

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) this.pauseGame();
            else this.resumeGame();
        });
    },

    cacheDOM() {
        this.dom.scenes = {
            menu: document.getElementById('menu-scene'),
            game: document.getElementById('game-scene'),
            over: document.getElementById('game-over-scene'),
            ad: document.getElementById('revive-overlay')
        };
        this.dom.gameArea = document.getElementById('game-area');
        this.dom.timerContainer = document.querySelector('.timer-container');
        this.dom.timerBar = document.getElementById('timer-bar');
        this.dom.scoreDisplay = document.getElementById('current-score');
        this.dom.comboBadge = document.getElementById('combo-badge');
        this.dom.modeLabel = document.getElementById('mode-label');
        this.dom.btnContinue = document.getElementById('btn-continue');
        this.dom.musicBtn = document.getElementById('music-toggle');
        this.dom.memoryStatus = document.getElementById('memory-status');

        this.dom.iconMusicOn = document.getElementById('icon-music-on');
        this.dom.iconMusicOff = document.getElementById('icon-music-off');
        this.dom.iconSoundOn = document.getElementById('icon-sound-on');
        this.dom.iconSoundOff = document.getElementById('icon-sound-off');
    },

    bindEvents() {
        const unlock = () => AudioController.init();
        document.body.addEventListener('click', unlock, { once: true });
        document.body.addEventListener('touchstart', unlock, { once: true });

        document.getElementById('btn-classic').onclick = () => this.selectMode('classic');
        document.getElementById('btn-frenzy').onclick = () => this.selectMode('frenzy');
        document.getElementById('btn-memory').onclick = () => this.selectMode('memory');
        document.getElementById('btn-play-again').onclick = () => this.playAgain();
        document.getElementById('btn-menu').onclick = () => this.changeScene('menu');
        this.dom.btnContinue.onclick = () => this.revive();

        document.getElementById('music-toggle').onclick = () => this.toggleMusic();
        document.getElementById('sound-toggle').onclick = () => this.toggleSound();

        this.dom.gameArea.onpointerdown = (e) => {
            if (!this.state.isPlaying || this.state.currentMode === 'memory') return; // Handled separately

            if (!e.target.closest('.dot')) {
                 AudioController.playMiss();
                this.state.timeLeft -= 10;
                this.state.combo = 0;
                this.updateUI();
                document.body.classList.add('shake');
                setTimeout(() => document.body.classList.remove('shake'), 200);
            }
        };
    },

    toggleMusic() {
        AudioController.musicEnabled = !AudioController.musicEnabled;
        this.dom.iconMusicOn.classList.toggle('hidden');
        this.dom.iconMusicOff.classList.toggle('hidden');
        if (AudioController.musicEnabled) {
            AudioController.init();
            if (!this.dom.scenes.game.classList.contains('hidden')) AudioController.startMusic('game');
            else AudioController.startMusic('menu');
        } else {
            AudioController.stopBGM();
        }
    },

    toggleSound() {
        AudioController.sfxMuted = !AudioController.sfxMuted;
        this.dom.iconSoundOn.classList.toggle('hidden');
        this.dom.iconSoundOff.classList.toggle('hidden');
        AudioController.init();
    },

    updatePersonalBests() {
        const classic = document.getElementById('best-score-classic-menu');
        const frenzy = document.getElementById('best-score-frenzy-menu');
        const memory = document.getElementById('best-score-memory-menu');
        if(classic) classic.innerText = this.state.bestClassic;
        if(frenzy) frenzy.innerText = this.state.bestFrenzy;
        if(memory) memory.innerText = this.state.bestMemory;
    },

    changeScene(name) {
        this.stop(); 

        Object.values(this.dom.scenes).forEach(el => el.classList.add('hidden'));
        this.dom.scenes[name].classList.remove('hidden');

        if (name === 'menu') {
            this.dom.musicBtn.classList.remove('hidden');
            AudioController.startMusic('menu');
            this.dom.timerContainer.classList.add('hidden'); 
        } else {
            this.dom.musicBtn.classList.add('hidden');
            if (name === 'game') {
                AudioController.startMusic('game');
                this.dom.timerContainer.classList.remove('hidden'); 
            } else {
                AudioController.stopBGM();
                this.dom.timerContainer.classList.add('hidden'); 
            }
        }
    },

    selectMode(mode) {
        AudioController.init();
        this.state.currentMode = mode;
        this.dom.modeLabel.innerText = mode.toUpperCase();
        let color = 'var(--primary)';
        if (mode === 'frenzy') color = 'var(--frenzy)';
        if (mode === 'memory') color = 'var(--yellow)';
        this.dom.modeLabel.style.color = color;

        this.state.score = 0;
        this.state.hasRevived = false;
        this.changeScene('game');
        setTimeout(() => this.start(), 50);
    },

    playAgain() {
        this.state.score = 0;
        this.state.hasRevived = false;
        this.changeScene('game');
        setTimeout(() => this.start(), 50);
    },

    start() {
        this.state.timeLeft = (this.state.currentMode === 'memory') ? 50 : this.config.INITIAL_TIME;
        this.state.isPlaying = true;
        this.state.isPaused = false;
        this.dom.memoryStatus.classList.add('hidden');
        this.dom.comboBadge.style.opacity = 0; 
        this.dom.comboBadge.classList.remove('visible');

        if (!this.state.hasRevived) {
            this.state.dotSpeed = 1600;
            this.state.combo = 0;
        }

        this.updateUI();

        if (this.state.currentMode === 'frenzy') this.startFrenzyLoop();
        else if (this.state.currentMode === 'memory') this.startMemoryGame();
        else this.spawnDot();

        // Main Loop
        this.timers.game = setInterval(() => this.tick(), 16);
    },

    tick() {
        if (this.state.isPaused) return;

        // Memory Mode handling
        if (this.state.currentMode === 'memory') {
            // Decay only on player turn
            if (this.state.isPlayerTurn) {
                this.state.timeLeft -= 0.15; 
            }
        } else {
             const decay = this.state.currentMode === 'frenzy' ? this.config.DECAY_FRENZY : this.config.DECAY_CLASSIC;
             this.state.timeLeft -= decay;
        }

        if (this.state.timeLeft <= 0) {
            this.end();
            return;
        }

        if (this.dom.timerBar) {
            this.dom.timerBar.style.width = `${this.state.timeLeft}%`;
            this.dom.timerBar.style.backgroundColor = this.state.timeLeft < 25 
                ? '#ef4444' 
                : (this.state.currentMode === 'frenzy' ? 'var(--frenzy)' : (this.state.currentMode === 'memory' ? 'var(--yellow)' : 'var(--primary)'));
        }
    },

    pauseGame() {
        this.state.isPaused = true;
        clearTimeout(this.timers.spawn);
        clearTimeout(this.timers.frenzy);
        clearTimeout(this.timers.memory);
    },

    resumeGame() {
        if (!this.state.isPlaying) return;
        this.state.isPaused = false;
        if (this.state.currentMode === 'frenzy') this.startFrenzyLoop();
        else if (this.state.currentMode === 'classic') this.spawnDot();
    },

    stop() {
        this.state.isPlaying = false;
        clearInterval(this.timers.game);
        clearTimeout(this.timers.spawn);
        clearTimeout(this.timers.frenzy);
        clearTimeout(this.timers.memory);
        if(this.dom.gameArea) this.dom.gameArea.innerHTML = '';
        this.dom.memoryStatus.classList.add('hidden');
    },

    end() {
        this.stop();
        AudioController.playGameOver();

        let currentBest = 0;
        if (this.state.currentMode === 'classic') currentBest = this.state.bestClassic;
        else if (this.state.currentMode === 'frenzy') currentBest = this.state.bestFrenzy;
        else currentBest = this.state.bestMemory;

        const msg = document.getElementById('over-message');

        if (this.state.score > currentBest) {
            if (this.state.currentMode === 'classic') {
                this.state.bestClassic = this.state.score;
                localStorage.setItem('dotDashBestClassic', this.state.score);
            } else if (this.state.currentMode === 'frenzy') {
                this.state.bestFrenzy = this.state.score;
                localStorage.setItem('dotDashBestFrenzy', this.state.score);
            } else {
                this.state.bestMemory = this.state.score;
                localStorage.setItem('dotDashBestMemory', this.state.score);
            }
            msg.innerText = "NEW BEST!";
            msg.style.color = "var(--yellow)";
        } else {
            msg.innerText = `BEST: ${currentBest}`;
            msg.style.color = "#94a3b8";
        }

        document.getElementById('final-score').innerText = this.state.score;
        this.updatePersonalBests();

        if (!this.state.hasRevived) {
            this.dom.btnContinue.classList.remove('hidden');
            this.dom.btnContinue.classList.add('flex');
        } else {
            this.dom.btnContinue.classList.add('hidden');
            this.dom.btnContinue.classList.remove('flex');
        }

        this.changeScene('over');
    },

    revive() {
        this.dom.scenes.over.classList.add('hidden');
        this.dom.scenes.ad.classList.remove('hidden');
        this.dom.scenes.ad.style.display = 'flex';

        // Ask wrapper to show rewarded ad
        if (window.showRewardedAd) {
            window.showRewardedAd(AdConfig.rewardId, () => {
                // Callback: player watched ad fully
                this.state.hasRevived = true;
                this.changeScene('game');
                setTimeout(() => this.start(), 50);
            });
        } else {
            // Fallback logic
            let time = 3;
            const timerEl = document.getElementById('revive-timer');
            timerEl.innerText = time;

            const interval = setInterval(() => {
                time--;
                if(time > 0) timerEl.innerText = time;
                else {
                    clearInterval(interval);
                    this.dom.scenes.ad.classList.add('hidden');
                    this.state.hasRevived = true;
                    this.changeScene('game');
                    setTimeout(() => this.start(), 50);
                }
            }, 1000);
        }
    },

    // --- MEMORY MODE LOGIC ---
    startMemoryGame() {
        this.dom.gameArea.innerHTML = '';
        this.dom.gameArea.className = 'relative w-full h-full flex items-center justify-center'; 

        const grid = document.createElement('div');
        grid.className = 'memory-grid';
        this.dom.gameArea.appendChild(grid);

        this.memoryColors.forEach((item, index) => {
            const dot = document.createElement('div');
            dot.className = 'memory-dot';
            dot.style.backgroundColor = item.color;
            dot.style.boxShadow = `0 0 10px ${item.color}`;
            dot.dataset.id = index;

            dot.onpointerdown = (e) => { 
                e.preventDefault();
                this.handleMemoryTap(index, dot);
            };
            grid.appendChild(dot);
        });

        if (!this.state.hasRevived) {
            this.state.memorySequence = [];
        }
        this.nextMemoryRound(!this.state.hasRevived); 
    },

    nextMemoryRound(addNew) {
        if(addNew) {
            const nextStep = Math.floor(Math.random() * 8);
            this.state.memorySequence.push(nextStep);
        }
        this.state.playerStep = 0;
        this.state.isPlayerTurn = false;
        this.playMemorySequence();
    },

    playMemorySequence() {
        this.updateMemoryStatus("WATCH", "#fbbf24");
        let i = 0;
        const interval = setInterval(() => {
            if (!this.state.isPlaying) { clearInterval(interval); return; }

            if (i >= this.state.memorySequence.length) {
                clearInterval(interval);
                this.state.isPlayerTurn = true;
                this.updateMemoryStatus("YOUR TURN", "#fff");
                return;
            }

            const dotId = this.state.memorySequence[i];
            this.flashMemoryDot(dotId);
            i++;
        }, 800); 
    },

    flashMemoryDot(id) {
        const dots = document.querySelectorAll('.memory-dot');
        if (dots[id]) {
            const dot = dots[id];

            if (dot.dataset.animTimeout) {
                clearTimeout(Number(dot.dataset.animTimeout));
            }

            dot.classList.remove('memory-active');
            void dot.offsetWidth; 
            dot.classList.add('memory-active');

            AudioController.playTone(300 + (id * 50), 'sine', 0.2, 0.1); 

            const timeout = setTimeout(() => {
                dot.classList.remove('memory-active');
            }, 400);

            dot.dataset.animTimeout = timeout;
        }
    },

    handleMemoryTap(id, dotElement) {
        if (!this.state.isPlayerTurn || !this.state.isPlaying) return;

        if (dotElement.dataset.clickTimeout) {
            clearTimeout(Number(dotElement.dataset.clickTimeout));
        }

        dotElement.classList.remove('memory-active');
        void dotElement.offsetWidth; 
        dotElement.classList.add('memory-active');

        const animTimeout = setTimeout(() => {
            dotElement.classList.remove('memory-active');
        }, 200); 

        dotElement.dataset.clickTimeout = animTimeout;

        const correctId = this.state.memorySequence[this.state.playerStep];

        if (id === correctId) {
            AudioController.playTone(300 + (id * 50), 'sine', 0.2, 0.1);
            this.state.playerStep++;

            if (this.state.playerStep >= this.state.memorySequence.length) {
                this.state.score++;
                this.state.timeLeft = Math.min(100, this.state.timeLeft + 20); 
                this.updateUI();
                this.state.isPlayerTurn = false;
                setTimeout(() => this.nextMemoryRound(true), 1000);
            }
        } else {
            AudioController.playMiss();
            this.end();
        }
    },

    updateMemoryStatus(text, color) {
        this.dom.memoryStatus.classList.remove('hidden');
        this.dom.memoryStatus.innerText = text;
        this.dom.memoryStatus.style.color = color;
    },

    // --- STANDARD MODES ---

    spawnDot() {
        if (!this.state.isPlaying || this.state.isPaused) return;
        this.dom.gameArea.innerHTML = '';
        this.dom.gameArea.className = 'relative w-full h-full'; 
        this.incrementSpawns();

        const dot = this.createDotElement(false, this.state.totalSpawns);
        this.dom.gameArea.appendChild(dot);

        this.timers.spawn = setTimeout(() => {
            if (this.state.isPlaying && !this.state.isPaused) {
                this.state.combo = 0;
                this.updateUI();
                this.spawnDot();
            }
        }, this.state.dotSpeed);
    },

    startFrenzyLoop() {
        this.dom.gameArea.className = 'relative w-full h-full'; 
        const tick = () => {
            if (!this.state.isPlaying || this.state.isPaused) return;

            const currentDots = this.dom.gameArea.querySelectorAll('.dot').length;
            if (currentDots < 6) {
                this.incrementSpawns();

                let type = 'standard';
                const isGhost = (this.state.totalSpawns === this.config.GHOST_TRIGGER);

                if (!isGhost) {
                    const roll = Math.random();
                    if (roll > 0.96) type = 'bomb';
                    else if (roll > 0.92) type = 'spike';
                    else if (roll > 0.85) type = 'implode';
                    else if (roll > 0.75) type = 'fall';
                    else if (roll > 0.65) type = 'balloon';
                    else if (roll > 0.55) type = 'tiny';
                    else if (roll > 0.45) type = 'bonus';
                }

                const dot = this.createDotElement(type, this.state.totalSpawns);
                this.dom.gameArea.appendChild(dot);

                if (type === 'fall') setTimeout(() => { if(dot.parentNode) dot.style.top = '110vh'; }, 50);
                if (type === 'balloon') setTimeout(() => { if(dot.parentNode) dot.style.top = '-100px'; }, 50);

                let lifeSpan = (Math.random() * 2000 + 1500);
                if (isGhost) lifeSpan = 4000;
                else if (type === 'implode') lifeSpan = 2000;
                else if (type === 'balloon') lifeSpan = 5000;
                else if (type === 'fall') lifeSpan = 4000;

                setTimeout(() => {
                    if (dot && dot.parentNode) {
                        dot.style.opacity = '0';
                        setTimeout(() => dot.remove(), 200);
                    }
                }, lifeSpan);
            }
            this.timers.frenzy = setTimeout(tick, Math.random() * 500 + 300);
        };
        tick();
    },

    incrementSpawns() {
        this.state.totalSpawns++;
        localStorage.setItem('dotDashTotalSpawns', this.state.totalSpawns);
    },

    createDotElement(type, spawnId) {
        const dot = document.createElement('div');
        const isGhost = (spawnId === this.config.GHOST_TRIGGER);

        if (isGhost) {
            dot.className = 'dot dot-ghost';
            const inner = document.createElement('div'); inner.className = 'ghost-inner'; dot.appendChild(inner);
            const face = document.createElement('div'); face.className = 'dot-ghost-face'; inner.appendChild(face);
            const le = document.createElement('div'); le.className = 'ghost-eye left'; face.appendChild(le);
            const re = document.createElement('div'); re.className = 'ghost-eye right'; face.appendChild(re);
            const pupils = document.createElement('div'); pupils.className = 'dot-ghost-pupils'; face.appendChild(pupils);
            const mouth = document.createElement('div'); mouth.className = 'dot-ghost-mouth'; face.appendChild(mouth);
            AudioController.playGhostWhisper();
        } else if (this.state.currentMode === 'classic') {
            const isBonus = Math.random() > 0.9;
            dot.className = `dot ${isBonus ? 'dot-bonus' : 'dot-standard'}`;
            dot.dataset.type = isBonus ? 'bonus' : 'standard';
        } else {
            switch(type) {
                case 'bonus': dot.className = 'dot dot-bonus'; break;
                case 'implode': dot.className = 'dot dot-shrink'; break;
                case 'fall': dot.className = 'dot dot-fall'; break;
                case 'balloon': dot.className = 'dot dot-balloon'; break;
                case 'tiny': dot.className = 'dot dot-tiny'; break;
                case 'bomb': dot.className = 'dot dot-bomb'; break;
                case 'spike': dot.className = 'dot dot-spike'; break;
                default: dot.className = 'dot dot-frenzy'; break;
            }
            dot.dataset.type = type;
        }

        // Adjust safe zone for ad banner (80px bottom padding)
        const size = 60;
        // Safe X: 20px padding
        const safeX = Math.random() * (window.innerWidth - size - 40) + 20;
        // Safe Y: Top (100px) to Bottom (Window - size - bottom padding 80px)
        const safeY = Math.random() * (window.innerHeight - size - 100 - 80) + 100;

        let y = safeY;

        if (type === 'fall') y = -80;
        if (type === 'balloon') y = window.innerHeight + 80;

        dot.style.left = `${safeX}px`;
        dot.style.top = `${y}px`;

        if (type !== 'fall' && type !== 'balloon') {
            dot.style.transform = 'scale(0)';
            requestAnimationFrame(() => { if(this.state.isPlaying) dot.style.transform = 'scale(1)'; });
        }

        dot.onpointerdown = (e) => this.handleTap(e, dot, isGhost);
        return dot;
    },

    handleTap(e, target, isGhost) {
        e.preventDefault();
        e.stopPropagation();

        const type = target.dataset.type || 'standard';
        let points = 1;
        let timeBonus = this.config.TIME_REGAIN;

        if (isGhost) {
            points = 10; timeBonus *= 2; AudioController.playBonus();
        } else if (type === 'spike') {
            this.state.score -= 5;
            this.state.timeLeft -= 5;
            AudioController.playDamage();
            this.showFloatingScore(e.clientX, e.clientY, "-5", "#ef4444");
            document.body.classList.add('shake');
            setTimeout(() => document.body.classList.remove('shake'), 200);
            target.remove();
            this.updateUI();
            return;
        } else if (type === 'bomb') {
            if (target.classList.contains('dot-bomb-lit')) return;
            target.classList.add('dot-bomb-lit');
            setTimeout(() => { if (target.parentNode) { this.explodeBomb(target); target.remove(); } }, 600);
            return;
        } else {
            if (type === 'bonus' || type === 'implode') { points = 5; timeBonus *= 2; AudioController.playBonus(); }
            else if (type === 'tiny' || type === 'fall') { points = 10; timeBonus *= 1.5; AudioController.playPop(); }
            else { AudioController.playPop(); }

            this.state.score += points;
            this.state.combo++;
            this.state.timeLeft = Math.min(100, this.state.timeLeft + timeBonus);
        }

        const particleColor = (type==='bonus') ? 'var(--yellow)' : (isGhost ? '#fff' : 'var(--primary)');
        this.createParticles(e.clientX, e.clientY, particleColor);
        this.showFloatingScore(e.clientX, e.clientY, `+${points}`, particleColor);

        this.updateUI();

        target.style.transform = 'scale(1.4) opacity(0)';
        setTimeout(() => target.remove(), 100);

        if (this.state.currentMode === 'classic') {
            this.state.dotSpeed = Math.max(320, this.state.dotSpeed * this.config.CLASSIC_ACCEL);
            clearTimeout(this.timers.spawn);
            this.spawnDot();
        }
    },

    explodeBomb(bombEl) {
        const rect = bombEl.getBoundingClientRect();
        const center = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };

        const boom = document.createElement('div');
        boom.className = 'explosion';
        boom.style.left = center.x + 'px';
        boom.style.top = center.y + 'px';
        document.body.appendChild(boom);
        setTimeout(() => boom.remove(), 500);
        AudioController.playExplosion();

        const allDots = document.querySelectorAll('.dot');
        let chainReaction = false;
        let nearbyDots = [];

        allDots.forEach(d => {
            if (d === bombEl) return;
            const r = d.getBoundingClientRect();
            const dCenter = { x: r.left + r.width/2, y: r.top + r.height/2 };
            const dist = Math.hypot(center.x - dCenter.x, center.y - dCenter.y);
            if (dist < 250) {
                nearbyDots.push(d);
                if (d.dataset.type === 'bomb') chainReaction = true;
            }
        });

        if (chainReaction) this.wipeScreen();
        else this.processExplosion(nearbyDots, center.x, center.y);
    },

    wipeScreen() {
            const allDots = this.dom.gameArea.querySelectorAll('.dot');
            let totalPoints = 0;
            let count = 0;

            allDots.forEach(d => {
                const type = d.dataset.type;
                if (type === 'spike') totalPoints += 25;
                else if (type === 'bonus' || type === 'implode') totalPoints += 5;
                else if (type === 'tiny' || type === 'fall') totalPoints += 10;
                else if (d.classList.contains('dot-ghost')) totalPoints += 10;
                else totalPoints += 2;

                d.style.transition = 'transform 0.1s ease-out';
                d.style.transform = 'scale(0)';
                setTimeout(() => d.remove(), 100);
                count++;
            });

            if (count > 0) {
                this.state.score += totalPoints;
                this.state.timeLeft = Math.min(100, this.state.timeLeft + (count * 5));

                this.showFloatingScore(window.innerWidth/2, window.innerHeight/2, `CHAIN REACTION!`, '#facc15');
                setTimeout(() => {
                    this.showFloatingScore(window.innerWidth/2, window.innerHeight/2 + 50, `+${totalPoints}`, '#fff');
                }, 200);

                this.updateUI();
                document.body.classList.add('shake');
                setTimeout(() => document.body.classList.remove('shake'), 500);

                AudioController.playExplosion();
                setTimeout(() => AudioController.playExplosion(), 150);
                setTimeout(() => AudioController.playExplosion(), 300);
            }
    },

    processExplosion(dots, x, y) {
        let popped = 0;
        let bombPoints = 0;
        dots.forEach(d => {
            if (d.dataset.type === 'spike') { bombPoints += 25; popped++; }
            else { bombPoints += 2; popped++; }
            d.style.transform = 'scale(0)';
            setTimeout(() => d.remove(), 100);
        });

        if (popped > 0) {
            this.state.score += bombPoints;
            this.state.timeLeft = Math.min(100, this.state.timeLeft + (popped * 5));
            this.showFloatingScore(x, y, `BOOM! +${bombPoints}`, '#ef4444');
            this.updateUI();
        }
    },

    updateUI() {
        if (this.dom.scoreDisplay) this.dom.scoreDisplay.innerText = this.state.score;
        const comboEl = document.getElementById('combo-val');
        if (comboEl) comboEl.innerText = this.state.combo;

        if (this.dom.comboBadge) {
            if (this.state.combo > 4) {
                this.dom.comboBadge.classList.remove('opacity-0', 'translate-y-2');
                if (this.dom.scoreDisplay) this.dom.scoreDisplay.style.color = 'var(--accent)';
            } else {
                this.dom.comboBadge.classList.add('opacity-0', 'translate-y-2');
                if (this.dom.scoreDisplay) this.dom.scoreDisplay.style.color = 'white';
            }

            if (this.state.combo > 4) {
                    this.dom.comboBadge.classList.add('visible');
            } else {
                    this.dom.comboBadge.classList.remove('visible');
            }
        }
    },

    createParticles(x, y, color) {
        if (!x || !y) return;

        for (let i = 0; i < 12; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            const size = Math.random() * 6 + 4;
            // Direct style assignment
            p.style.left = `${x}px`;
            p.style.top = `${y}px`;
            p.style.width = `${size}px`;
            p.style.height = `${size}px`;
            p.style.backgroundColor = color;
            p.style.boxShadow = `0 0 10px ${color}`;

            const tx = (Math.random() - 0.5) * 200;
            const ty = (Math.random() - 0.5) * 200;
            p.style.setProperty('--tx', `${tx}px`);
            p.style.setProperty('--ty', `${ty}px`);

            document.body.appendChild(p);
            setTimeout(() => p.remove(), 500);
        }
    },

    showFloatingScore(x, y, text, color) {
        if (!x || !y) return;

        const f = document.createElement('div');
        f.className = 'score-float';
        f.style.left = `${x}px`;
        f.style.top = `${y - 40}px`;
        f.style.color = color;
        f.style.fontSize = '1.5rem';
        f.innerText = text;
        document.body.appendChild(f);
        setTimeout(() => f.remove(), 700);
    }
};

window.addEventListener('DOMContentLoaded', () => DotDash.init());