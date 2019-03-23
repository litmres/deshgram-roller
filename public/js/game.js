window.onload = function() {

    var game = new Phaser.Game('100%', '100%', Phaser.AUTO, '');
    game.state.add('PreloadJson', { preload: preloadJson, create: startPlay });
    game.state.add('Play', { preload: preload, create: create, render: render });
    game.state.start('PreloadJson');

    var axisWidth = 30;
    var symbols = Phaser.ArrayUtils.shuffle('abcdefghijklmopqrstuvwxyz'.split('')).slice(0, 18);
    var textStyle = { fill: '#333333', font: 'bold 20px Arial', align: 'center', boundsAlignH: 'center', boundsAlignV: 'middle' };
    var tweenDuration = 500;
    var tweenEase = 'Linear';
    var axesCount;
    var verticalAxesCount;
    var horizontalAxesCount;
    var leftAxesCount;
    var rightAxesCount;
    var topAxesCount;
    var bottomAxesCount;
    var verticalCellsCount;
    var horizontalCellsCount;
    var maxCellsSide;
    var totalCellsCount;
    var cellSize;
    var cells;
    var grayFilter;
    var axes;
    var hud;
    var axisDown;
    var axisOver;
    var shuffling;
    var actionsCounter;
    var pictureUrl;

    function preloadJson() {
        game.plugins.add(PhaserNineSlice.Plugin);
        game.load.script('gray', 'https://cdn.jsdelivr.net/npm/phaser-ce@2.12.0/filters/Gray.js');
        game.load.json('picturesMetadata', 'pictures-metadata.json');
    }

    function startPlay() {
        game.state.start('Play');
    }

    function preload () {

        axesCount = Math.floor(Number(localStorage.getItem('solvedAxesCount') || '3') + 1);
        if (isNaN(axesCount) || axesCount < 4) {
            axesCount = 4;
        } else if (axesCount >= 10) {
            axesCount = Math.floor(Math.random() * 6) + 4;
        }

        verticalAxesCount = Math.floor(axesCount / 2);
        horizontalAxesCount = Math.ceil(axesCount / 2);
        leftAxesCount = Math.ceil(verticalAxesCount / 2);
        rightAxesCount = Math.floor(verticalAxesCount / 2);
        topAxesCount = Math.ceil(horizontalAxesCount / 2);
        bottomAxesCount = Math.floor(horizontalAxesCount / 2);
        verticalCellsCount = Math.pow(2, verticalAxesCount);
        horizontalCellsCount = Math.pow(2, horizontalAxesCount);
        maxCellsSide = Math.max(verticalCellsCount, horizontalCellsCount);
        totalCellsCount = verticalCellsCount * horizontalCellsCount;
        cellSize = 512 / Math.min(verticalCellsCount, horizontalCellsCount);
        shuffling = true;
        actionsCounter = 0;

        var solvedPictures = localStorage.getItem('solvedPictures');
        solvedPictures = solvedPictures === null ? [] : solvedPictures.split('|');

        var picturesMetadata = game.cache.getJSON('picturesMetadata');
        var keys = Object.keys(picturesMetadata).filter(function (key) {
            return picturesMetadata[key].aspectRatio === (horizontalAxesCount > verticalAxesCount ? 2 : 1) && solvedPictures.indexOf(key) === -1;
        });

        if (keys.length === 0) {
            keys = Object.keys(picturesMetadata).filter(function (key) {
                return picturesMetadata[key].aspectRatio === (horizontalAxesCount > verticalAxesCount ? 2 : 1);
            });
        }

        pictureUrl = keys[Math.floor(Math.random() * keys.length)];
        game.load.spritesheet('picture', 'assets/' + pictureUrl, cellSize, cellSize);
    }

    function createCells () {
        cells = game.add.group();
        cells.x = 2 * axisWidth;
        cells.y = 3 * axisWidth;

        grayFilter = game.add.filter('Gray');

        for (var y = 0; y < verticalCellsCount; ++y) {
            for (var x = 0; x < horizontalCellsCount; ++x) {
                var cellIndex = x + y * horizontalCellsCount;
                var cell = game.add.sprite(0, 0, 'picture', cellIndex, cells);
                cell.x = x * cellSize;
                cell.y = y * cellSize;
            }
        }

        cells.filters = [grayFilter];
    }

    function calcTargetPosition(axis) {
        var targetPosition = {
            targetX: -axisWidth * 0.5,
            targetY: -axisWidth * 0.5
        };
        var log2 = Math.log(axis.isRepeated) / Math.LN2;
        if (axis.isHorizontal) {
            targetPosition.targetY += (log2 < topAxesCount) ? -axisWidth * log2 : cellSize * verticalCellsCount + axisWidth * (log2 - topAxesCount + 1);
        } else {
            targetPosition.targetX += (log2 < leftAxesCount) ? -axisWidth * log2 : cellSize * horizontalCellsCount + axisWidth * (log2 - leftAxesCount + 1);
        }

        return targetPosition;
    }

    function hideOnTweenComplete(target, tween, cell) {
        cell.visible = false;
    }

    function updateTextureOnTweenUpdate(tween) {
        tween.target.renderTexture();
    }

    function updateTextureOnTweenComplete(target) {
        target.renderTexture();
    }

    function toggleAxisRepeated(axis, span) {
        axis.isRepeated = span;

        var targetPosition = calcTargetPosition(axis);

        if (shuffling) {
            axis.x = targetPosition.targetX;
            axis.y = targetPosition.targetY;
        } else {
            game.add.tween(axis).to({
                x: targetPosition.targetX,
                y: targetPosition.targetY
            }, tweenDuration, tweenEase, true);
        }

        var handler = function (target, tween, cell) { cell.visible = false; };
        for (var x = 0; x < maxCellsSide; ++x) {
            var cell = axis.getAt(x);
            var hide = (x + 1) * span > (axis.isHorizontal ? horizontalCellsCount : verticalCellsCount);

            if (shuffling) {
                cell.getAt(0).resize(cellSize * span, axisWidth);
                cell.getAt(1).x = cellSize * span * 0.5;
                cell.x = x * cellSize * span;
                if (hide) {
                    cell.visible = false;
                    cell.scale.x = 0;
                    cell.scale.y = 0;
                } else {
                    cell.visible = true;
                    cell.scale.x = 1;
                    cell.scale.y = 1;
                }
            } else {
                // HACK: Using NineSlice.localWidth and NineSlice.renderTexture directly
                game.add.tween(cell.getAt(0)).to({ localWidth: cellSize * span }, tweenDuration, tweenEase, true)
                    .onUpdateCallback(updateTextureOnTweenUpdate)
                    .onComplete.addOnce(updateTextureOnTweenComplete, this, 0);
                game.add.tween(cell.getAt(1)).to({ x: cellSize * span * 0.5 }, tweenDuration, tweenEase, true);
                game.add.tween(cell).to({ x: x * cellSize * span }, tweenDuration, tweenEase, true);
                if (hide) {
                    game.add.tween(cell.scale).to({ x: 0, y: 0 }, tweenDuration, tweenEase, true)
                        .onComplete.addOnce(hideOnTweenComplete, this, 0, cell);
                } else {
                    cell.visible = true;
                    game.add.tween(cell.scale).to({ x: 1, y: 1 }, tweenDuration, tweenEase, true);
                }
            }
        }
    }

    function toggleAxisForward(axis) {
        axis.isForward = !axis.isForward;

        for (var x = 0; x < maxCellsSide; x += 2) {
            var cell1 = axis.getAt(x);
            var cell2 = axis.getAt(x + 1);
            axis.swap(cell1, cell2);

            if (shuffling) {
                cell1.x = cellSize * axis.isRepeated * (x + 1);
                cell2.x = cellSize * axis.isRepeated * x;
            } else {
                game.add.tween(cell1).to({ x: cellSize * axis.isRepeated * (x + 1) }, tweenDuration, tweenEase, true);
                game.add.tween(cell2).to({ x: cellSize * axis.isRepeated * x }, tweenDuration, tweenEase, true);
            }
        }
    }

    function toggleAxisHorizontal(axis) {
        axis.isHorizontal = !axis.isHorizontal;

        var targetPosition = calcTargetPosition(axis);

        if (shuffling) {
            axis.rotation = axis.isHorizontal ? 0 : Math.PI * 0.5;
            axis.x = targetPosition.targetX;
            axis.y = targetPosition.targetY;
        } else {
            game.add.tween(axis).to({
                rotation: axis.isHorizontal ? 0 : Math.PI * 0.5,
                x: targetPosition.targetX,
                y: targetPosition.targetY
            }, tweenDuration, tweenEase, true);
        }

        for (var x = 0; x < maxCellsSide; ++x) {
            var cell = axis.getAt(x);

            if (shuffling) {
                cell.getAt(1).rotation = axis.isHorizontal ? 0 : -Math.PI * 0.5;
            } else {
                game.add.tween(cell.getAt(1)).to({
                    rotation: axis.isHorizontal ? 0 : -Math.PI * 0.5
                }, tweenDuration, tweenEase, true);
            }
        }
    }

    function updateCells() {
        for (var i = 0; i < totalCellsCount; ++i) {
            var cell = cells.getAt(i);
            var x = 0;
            var y = 0;
            for (var j = 0, c = i >> j & 1; j < axesCount; ++j, c = i >> j & 1) {
                var axis = axes.getAt(j);
                if (axis.isHorizontal) {
                    x += (axis.isForward ? c : 1 - c) * axis.isRepeated;
                } else {
                    y += (axis.isForward ? c : 1 - c) * axis.isRepeated;
                }
            }
            if (shuffling) {
                cell.x = x * cellSize;
                cell.y = y * cellSize;
            } else {
                game.add.tween(cell).to({
                    x: x * cellSize,
                    y: y * cellSize
                }, tweenDuration, tweenEase, true);
            }
        }
    }

    function getAxisInitialConfig(index) {
        return {
            isRepeated: Math.pow(2, index % horizontalAxesCount),
            isHorizontal: index < horizontalAxesCount,
            isForward: true
        };
    }

    function getAxisDistanceFromInitialConfig(index) {
        var score = 0;
        var axis = axes.getAt(index);
        var initialConfig = getAxisInitialConfig(index);

        if (axis.isRepeated !== initialConfig.isRepeated || axis.isHorizontal !== initialConfig.isHorizontal) {
            score += 1;
        }

        if (axis.isForward !== initialConfig.isForward) {
            score += 1;
        }

        return score;
    }

    function getTotalDistanceFromInitialConfig() {
        var score = 0;

        for (var i = 0; i < axesCount; ++i) {
            score += getAxisDistanceFromInitialConfig(i);
        }

        return score;
    }

    function onDown(sprite, pointer, axis) {
        axisDown = axis;
    }

    function onOver(sprite, pointer, axis) {
        axisOver = axis;
    }

    function onOut(sprite, pointer, axis) {
        if (axis === axisOver) {
            axisOver = null;
        }
    }

    function onUp() {
        if (axisDown && axisOver && (shuffling || getTotalDistanceFromInitialConfig() > 0)) {
            if (axisDown === axisOver) {
                toggleAxisForward(axisOver);
            }
            if (axisDown.isHorizontal !== axisOver.isHorizontal) {
                toggleAxisHorizontal(axisDown);
                toggleAxisHorizontal(axisOver);
                if (axisDown.isRepeated === axisOver.isRepeated) {
                    toggleAxisRepeated(axisDown, axisDown.isRepeated);
                    toggleAxisRepeated(axisOver, axisOver.isRepeated);
                }
            }
            if (axisDown.isRepeated !== axisOver.isRepeated) {
                var axisDownSpan = axisDown.isRepeated;
                toggleAxisRepeated(axisDown, axisOver.isRepeated);
                toggleAxisRepeated(axisOver, axisDownSpan);
            }
            updateCells();
            updateActionsCounter();

            if (!shuffling && getTotalDistanceFromInitialConfig() === 0) {
                localStorage.setItem('solvedAxesCount', String(axesCount));

                var solvedPictures = localStorage.getItem('solvedPictures');
                solvedPictures = solvedPictures === null ? [] : solvedPictures.split('|');
                solvedPictures.push(pictureUrl);
                localStorage.setItem('solvedPictures', solvedPictures.join('|'));

                game.add.tween(grayFilter).to({ gray: 0 }, tweenDuration * 2, tweenEase, true);
                game.add.tween(axes).to({ alpha: 0 }, tweenDuration, tweenEase, true);
                hud.getAt(1).visible = true;
                hud.getAt(2).visible = true;
            }
        }

        axisDown = null;
        axisOver = null;
    }

    function createAxes () {
        axes = game.add.group();
        axes.x = 2 * axisWidth;
        axes.y = 3 * axisWidth;

        var cellBackgroundGraphics = game.add.graphics();

        cellBackgroundGraphics.beginFill(0xFFFFFF);
        cellBackgroundGraphics.lineStyle(1, 0x333333, 1);
        cellBackgroundGraphics.drawRect(0, 0, cellSize, axisWidth);
        cellBackgroundGraphics.endFill();

        var cellBackgroundTexture = cellBackgroundGraphics.generateTexture();
        cellBackgroundGraphics.destroy();

        for (var y = 0; y < axesCount; ++y) {
            var axis = game.add.group(axes);
            axis.isRepeated = 1;
            axis.isHorizontal = true;
            axis.isForward = true;

            for (var x = 0; x < maxCellsSide; ++x) {
                var cell = game.add.group(axis);
                cell.inputEnableChildren = true;
                cell.onChildInputDown.add(onDown, this, 0, axis);
                cell.onChildInputOver.add(onOver, this, 0, axis);
                cell.onChildInputOut.add(onOut, this, 0, axis);
                cell.onChildInputUp.add(onUp, this, 0);
                var cellBackgroundSprite = new PhaserNineSlice.NineSlice(game, 0, 0, cellBackgroundTexture, null, cellSize, axisWidth, {
                    top: 3,
                    bottom: 3,
                    left: 3,
                    right: 3
                });
                cell.add(cellBackgroundSprite);
                var str = symbols[y * 2 + x % 2];
                var cellText = game.add.text(cellSize * 0.5, axisWidth * 0.5, str, textStyle);
                cellText.setTextBounds(-cellSize * 0.5, -cellSize * 0.5, cellSize, cellSize);
                cell.add(cellText);
                cell.x = x * cellSize;
            }

            axis.pivot.y = axisWidth * 0.5;
            axis.pivot.x = -axisWidth * 0.5;
            axis.x = -axisWidth * 0.5;
            axis.y = -axisWidth * 0.5;

            if (y >= horizontalAxesCount) {
                toggleAxisHorizontal(axis);
            }
            toggleAxisRepeated(axis, Math.pow(2, y % horizontalAxesCount));
        }
    }

    function handleRestartButton() {
        game.state.restart();
    }

    function createHud() {
        hud = game.add.group();
        var actionsCounterText = game.add.text(0, 0, 'Actions: ' + actionsCounter, { fill: '#FF9999', font: 'bold 20px Arial', align: 'center', boundsAlignH: 'center', boundsAlignV: 'middle' });
        hud.add(actionsCounterText);

        var picturesMetadata = game.cache.getJSON('picturesMetadata');
        var source = picturesMetadata[pictureUrl].source;
        var sourceText = game.add.text(2 * axisWidth, 3 * axisWidth + 512, source, { fill: '#FF9999', font: 'bold 20px Arial', align: 'center', boundsAlignH: 'center', boundsAlignV: 'middle' });
        sourceText.visible = false;
        hud.add(sourceText);

        var nextLevelButtonGroup = game.add.group(hud);
        var nextLevelText = game.add.text(0, 0, 'Next level >', { fill: '#FF9999', font: 'bold 20px Arial', align: 'center', boundsAlignH: 'center', boundsAlignV: 'middle' });
        var nextLevelTextBounds = nextLevelText.getBounds();
        var nextLevelButtonBgGraphics = game.add.graphics();
        nextLevelButtonBgGraphics.beginFill(0x000000);
        nextLevelButtonBgGraphics.drawRect(0, 0, nextLevelTextBounds.width, nextLevelTextBounds.height);
        nextLevelButtonBgGraphics.endFill();
        var nextLevelButtonBgTexture = nextLevelButtonBgGraphics.generateTexture();
        nextLevelButtonBgGraphics.destroy();
        game.cache.addImage('nextLevelButtonBg', null, nextLevelButtonBgTexture.baseTexture.source);
        var nextLevelButton = game.add.button(0,0,'nextLevelButtonBg',handleRestartButton,this);
        nextLevelButton.alpha = 0;
        nextLevelButtonGroup.visible = false;
        nextLevelButtonGroup.x = 512;
        nextLevelButtonGroup.add(nextLevelButton);
        nextLevelButtonGroup.add(nextLevelText);
    }

    function updateActionsCounter() {
        if (!shuffling) {
            hud.getAt(0).text = 'Actions: ' + (++actionsCounter);
        }
    }

    function shuffleAxes() {
        shuffling = true;
        //axes.visible = false;
        //cells.visible = false;
        for (
            var i = 0;
            i < axesCount * 2 || getTotalDistanceFromInitialConfig() < axesCount || getAxisDistanceFromInitialConfig(0) === 0 || getAxisDistanceFromInitialConfig(horizontalAxesCount) === 0;
            ++i
        ) {
            axisDown = axes.getAt(Math.floor(Math.random() * axesCount));
            axisOver = axes.getAt(Math.floor(Math.random() * axesCount));
            onUp();
        }
        //axes.visible = true;
        //cells.visible = true;
        shuffling = false;
    }

    function create () {
        createCells();
        createAxes();
        createHud();
        shuffleAxes();
    }

    function render() {
        if (axisDown) {
            game.debug.rectangle(axisDown.getBounds(), '#FF0000', false);
            if (axisOver && axisDown !== axisOver) {
                game.debug.rectangle(axisOver.getBounds(), '#FF0000', false);
            }
        } else {
            game.debug.reset();
        }
    }
};

