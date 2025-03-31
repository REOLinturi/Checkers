document.addEventListener('DOMContentLoaded', () => {
    const boardElement = document.getElementById('board');
    const turnElement = document.getElementById('turn');
    const messageElement = document.getElementById('message');
    const restartButton = document.getElementById('restart-button');

    const PLAYER1 = 1; // Red (Human)
    const PLAYER2 = 2; // Black (Computer)
    const EMPTY = 0;
    const P1_PIECE = 1;
    const P2_PIECE = 2;
    const P1_KING = 3;
    const P2_KING = 4;

    let board = [];
    let currentPlayer = PLAYER1;
    let selectedPiece = null; // { row, col, isKing, element }
    let validMoves = []; // Stores valid moves for the selected piece { row, col, isJump, jumpedPiece }
    let player1Pieces = 12;
    let player2Pieces = 12;
    let mustJump = false; // Flag if a jump is mandatory FOR THE CURRENT TURN
    let ongoingMultiJump = false; // Flag during a multi-jump sequence FOR THE CURRENT PIECE
    let gameOver = false;

    function createBoard() {
        board = [];
        for (let r = 0; r < 8; r++) {
            board[r] = [];
            for (let c = 0; c < 8; c++) {
                if (r < 3 && (r + c) % 2 !== 0) {
                    board[r][c] = P2_PIECE; // Player 2 (Black) at the top
                } else if (r > 4 && (r + c) % 2 !== 0) {
                    board[r][c] = P1_PIECE; // Player 1 (Red) at the bottom
                } else {
                    board[r][c] = EMPTY;
                }
            }
        }
    }

    function renderBoard() {
        boardElement.innerHTML = '';
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const square = document.createElement('div');
                square.classList.add('square');
                square.classList.add((r + c) % 2 === 0 ? 'light' : 'dark');
                square.dataset.row = r;
                square.dataset.col = c;

                const pieceType = board[r][c];
                if (pieceType !== EMPTY) {
                    const piece = document.createElement('div');
                    piece.classList.add('piece');
                    if (pieceType === P1_PIECE || pieceType === P1_KING) {
                        piece.classList.add('player1');
                    } else {
                        piece.classList.add('player2');
                    }
                    if (pieceType === P1_KING || pieceType === P2_KING) {
                        piece.classList.add('king');
                    }
                    square.appendChild(piece);
                }

                // Add click listener only to dark squares (playable squares)
                if ((r + c) % 2 !== 0) {
                    square.addEventListener('click', handleSquareClick);
                }
                boardElement.appendChild(square);
            }
        }
        updateStatus(); // Update turn display etc.
        // Re-apply selection and highlights if needed (e.g., after renderBoard during multi-jump)
        if (selectedPiece && selectedPiece.element) {
             const pieceElement = boardElement.querySelector(`[data-row='${selectedPiece.row}'][data-col='${selectedPiece.col}'] .piece`);
             if(pieceElement) {
                pieceElement.classList.add('selected');
                selectedPiece.element = pieceElement; // Update element reference just in case
             }
        }
        highlightValidMoves(); // Re-apply move highlights
    }


    function handleSquareClick(event) {
        if (gameOver || (currentPlayer === PLAYER2 && !ongoingMultiJump)) return; // Ignore clicks if game over or computer's turn (unless multi-jumping)

        const target = event.target.closest('.square'); // Get square even if piece is clicked
        if (!target) return;

        const row = parseInt(target.dataset.row);
        const col = parseInt(target.dataset.col);

        if (selectedPiece) {
            // Player is trying to move the selected piece
            const move = validMoves.find(m => m.row === row && m.col === col);
            if (move) {
                // Valid move clicked
                makeMove(selectedPiece, move);
            } else if (board[row][col] !== EMPTY && isCurrentPlayerPiece(row, col) && !ongoingMultiJump) {
                // Clicked on another piece of the current player - select it instead
                // (Only allow switching pieces if NOT in a multi-jump sequence)
                deselectPiece();
                selectPiece(row, col);
            } else {
                // Clicked on an invalid square or empty square (not a valid move)
                // OR clicked elsewhere during a mandatory multi-jump
                if(!ongoingMultiJump) { // Only deselect if not forced to continue jump
                   deselectPiece();
                } else {
                    showMessage("Must continue jump!"); // Remind player
                }
            }
        } else if (board[row][col] !== EMPTY && isCurrentPlayerPiece(row, col)) {
            // No piece was selected, now selecting one
            selectPiece(row, col);
        }
    }

    function isCurrentPlayerPiece(row, col) {
        const pieceType = board[row][col];
        if (currentPlayer === PLAYER1) {
            return pieceType === P1_PIECE || pieceType === P1_KING;
        } else {
            // Allow checking for player 2 piece during computer's multi-jump continuation
            return pieceType === P2_PIECE || pieceType === P2_KING;
        }
    }

    // --- MODIFIED FUNCTION ---
    function selectPiece(row, col, isMultiJumpContinuation = false) {
        // Clear previous selection state FIRST
        deselectPiece();

        // Check for mandatory jumps globally ONLY if this is the start of a turn/selection.
        // If continuing a multi-jump, we already know a jump MUST be made with THIS piece.
        if (!isMultiJumpContinuation) {
            const availableMoves = getAllPossibleMoves(currentPlayer);
            mustJump = availableMoves.some(move => move.isJump);

            if (mustJump) {
                // Check if the specific piece being selected (row, col) is one of the pieces that *can* make a mandatory jump.
                const pieceCanJump = availableMoves
                    .filter(move => move.isJump) // Only consider jumps
                    .some(jump => jump.startRow === row && jump.startCol === col);

                if (!pieceCanJump) {
                    showMessage("Mandatory jump exists - must select a piece that can jump.");
                    return; // Do not select this piece
                }
            }
        }

        // Proceed with selection
        const pieceElement = boardElement.querySelector(`[data-row='${row}'][data-col='${col}'] .piece`);
        if (!pieceElement) {
            console.error("Error: Could not find piece element in selectPiece at", row, col);
            // Attempt to recover state if possible, or just return
             ongoingMultiJump = false; // Reset flag if piece disappears?
            return;
        }

        const pieceType = board[row][col];
        const isKing = pieceType === P1_KING || pieceType === P2_KING;

        selectedPiece = { row, col, isKing, element: pieceElement };
        pieceElement.classList.add('selected');

        // Calculate moves specifically for THIS piece
        validMoves = calculateValidMovesForPiece(row, col, isKing);

        // Filter the moves:
        // 1. If continuing a multi-jump, we MUST take another jump with this piece.
        // 2. If it's the start of the turn AND global jumps are mandatory, we must take a jump.
        if (isMultiJumpContinuation || mustJump) {
             validMoves = validMoves.filter(move => move.isJump);
        }

        // Highlight the (now potentially filtered) valid moves
        highlightValidMoves();

        // Set appropriate message
        if (isMultiJumpContinuation && validMoves.length > 0) {
             showMessage("Must continue jump!");
        } else if (isMultiJumpContinuation && validMoves.length === 0) {
            // This case should ideally not happen if logic is correct, but handle it.
            // It implies a jump was possible, the piece moved, but now no further jumps exist from the new spot.
            // The turn should have ended in makeMove. Log an error for debugging.
             console.error("Error: In multi-jump but no further jumps found by selectPiece. Turn should have ended.");
             ongoingMultiJump = false; // Force end of sequence
             // Switch turn might be needed here depending on exact state, but let makeMove handle it
        } else if (mustJump) {
             showMessage("Mandatory Jump!");
        } else {
            showMessage(""); // Clear message if it's a normal move selection
        }
    }

    function deselectPiece() {
        if (selectedPiece && selectedPiece.element) {
            // Check if element still exists before trying to remove class
            const currentElement = boardElement.querySelector(`[data-row='${selectedPiece.row}'][data-col='${selectedPiece.col}'] .piece`);
             if (currentElement) {
                currentElement.classList.remove('selected');
            }
        }
        selectedPiece = null;
        validMoves = []; // Clear moves when deselecting
        removeHighlights(); // Clear highlights
    }


    function highlightValidMoves() {
        removeHighlights(); // Clear previous highlights
        validMoves.forEach(move => {
            const square = boardElement.querySelector(`[data-row='${move.row}'][data-col='${move.col}']`);
            if (square) {
                square.classList.add('valid-move');
            }
        });
    }

    function removeHighlights() {
        boardElement.querySelectorAll('.valid-move').forEach(sq => sq.classList.remove('valid-move'));
    }

    function calculateValidMovesForPiece(r, c, isKing) {
        let moves = [];
        const pieceType = board[r][c]; // Get piece type to determine owner
        if (pieceType === EMPTY) return []; // Cannot move an empty square

        const player = (pieceType === P1_PIECE || pieceType === P1_KING) ? PLAYER1 : PLAYER2;
        const opponent = player === PLAYER1 ? PLAYER2 : PLAYER1;
        const directions = [];

        // Determine movement directions based on player and king status
        if (player === PLAYER1 || isKing) {
            directions.push([-1, -1], [-1, 1]); // Up-left, Up-right (relative to P1)
        }
        if (player === PLAYER2 || isKing) {
            directions.push([1, -1], [1, 1]); // Down-left, Down-right (relative to P1)
        }

        // Check simple moves (only possible if no jumps are available for *any* piece this turn)
        for (const [dr, dc] of directions) {
            const nr = r + dr;
            const nc = c + dc;
            if (isValidSquare(nr, nc) && board[nr][nc] === EMPTY) {
                moves.push({ row: nr, col: nc, isJump: false });
            }
        }

        // Check jumps
        let jumps = [];
        for (const [dr, dc] of directions) {
            const ir = r + dr;   // Intermediate row (jumped piece)
            const ic = c + dc;   // Intermediate col
            const jr = r + dr * 2; // Jump landing row
            const jc = c + dc * 2; // Jump landing col

            if (isValidSquare(jr, jc) && board[jr][jc] === EMPTY && isValidSquare(ir, ic)) {
                const intermediatePiece = board[ir][ic];
                // Check if the intermediate piece belongs to the opponent
                const isOpponentPiece = (opponent === PLAYER1 && (intermediatePiece === P1_PIECE || intermediatePiece === P1_KING)) ||
                                        (opponent === PLAYER2 && (intermediatePiece === P2_PIECE || intermediatePiece === P2_KING));

                if (isOpponentPiece) {
                    // Add jump move
                    jumps.push({ row: jr, col: jc, isJump: true, jumpedPiece: { row: ir, col: ic } });
                }
            }
        }

        // IMPORTANT Checkers Rule: If any jump is available for this piece, only jumps are valid moves for it.
        if (jumps.length > 0) {
            return jumps; // Return only jumps if any exist for this piece
        } else {
            return moves; // Otherwise, return the simple moves
        }
    }


     function getAllPossibleMoves(player) {
        let allMoves = [];
        let hasJumps = false; // Does *any* piece of this player have a jump?

        // First pass: Check if ANY jump exists for the player
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const pieceType = board[r][c];
                const pieceOwner = (pieceType === P1_PIECE || pieceType === P1_KING) ? PLAYER1 : ((pieceType === P2_PIECE || pieceType === P2_KING) ? PLAYER2 : null);

                if (pieceOwner === player) {
                    const isKing = pieceType === P1_KING || pieceType === P2_KING;
                    // Specifically check if *this* piece can jump
                    const pieceJumps = calculateValidMovesForPiece(r, c, isKing).filter(m => m.isJump);
                    if (pieceJumps.length > 0) {
                        hasJumps = true;
                        break; // Found a jump, no need to check other pieces for this flag
                    }
                }
            }
             if (hasJumps) break; // Exit outer loop too
        }

        // Second pass: Collect all valid moves based on whether jumps are mandatory
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                 const pieceType = board[r][c];
                const pieceOwner = (pieceType === P1_PIECE || pieceType === P1_KING) ? PLAYER1 : ((pieceType === P2_PIECE || pieceType === P2_KING) ? PLAYER2 : null);

                if (pieceOwner === player) {
                    const isKing = pieceType === P1_KING || pieceType === P2_KING;
                    const pieceMoves = calculateValidMovesForPiece(r, c, isKing); // Gets jumps OR simple moves

                    // If jumps are mandatory globally, only add moves that ARE jumps.
                    // Otherwise, add all moves calculated (which will be simple moves if no jumps existed for that piece)
                    const movesToAdd = hasJumps ? pieceMoves.filter(move => move.isJump) : pieceMoves;

                    movesToAdd.forEach(move => {
                        // Add start position info for AI and selection logic
                        move.startRow = r;
                        move.startCol = c;
                        allMoves.push(move);
                    });
                }
            }
        }
        return allMoves;
    }

    function isValidSquare(r, c) {
        return r >= 0 && r < 8 && c >= 0 && c < 8;
    }

    function makeMove(startPieceData, endMoveData) {
        const { row: startRow, col: startCol } = startPieceData;
        const { row: endRow, col: endCol, isJump, jumpedPiece } = endMoveData;
        const movingPieceType = board[startRow][startCol];

        // 1. Update board: Move piece, clear start
        board[endRow][endCol] = movingPieceType;
        board[startRow][startCol] = EMPTY;

        let becomesKing = false;
        // 2. Check for kinging (before checking for multi-jump)
        const isNowKing = (movingPieceType === P1_PIECE && endRow === 0) || (movingPieceType === P2_PIECE && endRow === 7);
        if (isNowKing && (movingPieceType === P1_PIECE || movingPieceType === P2_PIECE)) {
             board[endRow][endCol] = (currentPlayer === PLAYER1) ? P1_KING : P2_KING;
             becomesKing = true; // Mark that kinging happened *this move*
        }
        const pieceAtEndIsKing = board[endRow][endCol] === P1_KING || board[endRow][endCol] === P2_KING; // Is the piece king *now*?


        // 3. Handle jump capture
        if (isJump && jumpedPiece) {
            const jumpedType = board[jumpedPiece.row][jumpedPiece.col];
            if (jumpedType !== EMPTY) { // Ensure we don't double-decrement if something went wrong
                board[jumpedPiece.row][jumpedPiece.col] = EMPTY;
                if (jumpedType === P1_PIECE || jumpedType === P1_KING) {
                    player1Pieces--;
                } else {
                    player2Pieces--;
                }
            }

            // Check win condition immediately after capture
            if(checkWinCondition()) { // checkWinCondition calls endGame if needed
                // If game ended, clean up and stop further processing for this move
                deselectPiece();
                renderBoard();
                return;
            }

            // --- MODIFIED MULTI-JUMP CHECK ---
            // Check for further jumps ONLY if the piece didn't *just* become a king this move.
            let furtherJumps = [];
            if (!becomesKing) {
                 furtherJumps = calculateValidMovesForPiece(endRow, endCol, pieceAtEndIsKing)
                               .filter(move => move.isJump); // calculateValidMoves already filters for jumps if they exist
            }

            if (furtherJumps.length > 0) {
                // Must continue jumping with the same piece!
                ongoingMultiJump = true;

                // DO NOT deselect piece data here, just clear visual selection/highlights
                if(selectedPiece && selectedPiece.element) selectedPiece.element.classList.remove('selected');
                removeHighlights();

                // Re-select the piece *at its new location* to calculate and show the *next* jump options.
                // Pass 'true' to indicate it's a multi-jump continuation.
                selectPiece(endRow, endCol, true);

                // Re-render to show the piece moved and the *new* highlights.
                renderBoard();

                // If it's the computer's turn to continue jumping, trigger its next move.
                if (currentPlayer === PLAYER2) {
                    showMessage("Computer continues jump..."); // Give feedback
                    setTimeout(computerMove, 600); // Slightly shorter delay for continuation
                }
                // IMPORTANT: Return here to prevent switching turns. The player (or AI) must make the next jump.
                return;
            }
            // If no further jumps, the jump sequence ends here. Fall through to switch turn.
        }

        // 4. Move complete (wasn't a jump or jump sequence finished)
        ongoingMultiJump = false; // Ensure this is reset
        deselectPiece();        // Clear selection state
        renderBoard();          // Update display
        switchTurn();           // Proceed to next player's turn
    }


    function switchTurn() {
        if (gameOver) return;

        currentPlayer = (currentPlayer === PLAYER1) ? PLAYER2 : PLAYER1;
        mustJump = false; // Reset mandatory jump flag for the new player's turn
        ongoingMultiJump = false; // Ensure multi-jump sequence is reset between turns
        deselectPiece(); // Ensure nothing is selected at turn switch

        // Check if the new player has ANY valid moves at all
        const possibleMoves = getAllPossibleMoves(currentPlayer);
        if (possibleMoves.length === 0) {
            endGame(currentPlayer === PLAYER1 ? PLAYER2 : PLAYER1); // The *other* player wins
            return;
        }

        // Update the turn display
        updateStatus();

        // If it's now the computer's turn, trigger its move
        if (currentPlayer === PLAYER2) {
            showMessage("Computer is thinking...");
            setTimeout(computerMove, 800); // Standard delay for AI thinking
        } else {
             // It's Player 1's turn. Check if they have a mandatory jump for *this* turn.
             mustJump = possibleMoves.some(move => move.isJump);
             if (mustJump) {
                showMessage("Your turn - You must make a jump!");
             } else {
                showMessage("Your turn.");
             }
        }
    }


    function computerMove() {
        if (gameOver) return;

        let possibleMoves;
        if (ongoingMultiJump && selectedPiece) {
            // Computer is continuing a multi-jump. validMoves should already be calculated
            // and filtered for jumps by the selectPiece call in makeMove.
            possibleMoves = validMoves.map(m => ({ ...m, startRow: selectedPiece.row, startCol: selectedPiece.col })); // Ensure start pos is included
             if (possibleMoves.length === 0) {
                 // Error case: Ongoing multi-jump flag set, but no jump moves found for the selected piece.
                 // This indicates a logic error elsewhere. End the sequence.
                 console.error("AI Error: In multi-jump but no valid jump moves found.");
                 ongoingMultiJump = false;
                 switchTurn(); // Try to recover by ending turn? Or check win?
                 return;
             }
        } else {
           // Standard turn: Get all possible moves for the AI
           possibleMoves = getAllPossibleMoves(PLAYER2);
        }

        // If AI truly has no moves (should be caught by switchTurn, but double-check)
        if (possibleMoves.length === 0) {
            endGame(PLAYER1); // Player 1 wins
            return;
        }

        // AI Strategy: Prioritize jumps, otherwise random move
        const jumps = possibleMoves.filter(move => move.isJump);
        let chosenMove;

        if (jumps.length > 0) {
            // Choose a random jump
            chosenMove = jumps[Math.floor(Math.random() * jumps.length)];
        } else {
            // Choose a random simple move
            chosenMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        }

        // Get the data needed for makeMove
        const startPieceType = board[chosenMove.startRow][chosenMove.startCol];
        const isKing = startPieceType === P1_KING || startPieceType === P2_KING;
        // Note: We don't need the 'element' for the AI move, just the position and type info.
        const startPieceData = { row: chosenMove.startRow, col: chosenMove.startCol, isKing: isKing, element: null };

        // Execute the chosen move
        makeMove(startPieceData, chosenMove);
        // makeMove will handle turn switching or continuing the AI's multi-jump sequence.
    }


     function checkWinCondition() {
         if (player1Pieces <= 0) {
            endGame(PLAYER2); // Player 2 (Computer) wins
            return true; // Game has ended
        }
        if (player2Pieces <= 0) {
            endGame(PLAYER1); // Player 1 (Human) wins
             return true; // Game has ended
        }
        // Check for no valid moves is handled more robustly in switchTurn
        return false; // Game continues
    }

    function endGame(winner) {
        if (gameOver) return; // Prevent multiple end game messages
        gameOver = true;
        const winnerName = winner === PLAYER1 ? "Red (You)" : "Black (Computer)";
        showMessage(`${winnerName} wins! Game Over.`);
        turnElement.textContent = "Game Over";
        deselectPiece(); // Ensure nothing is selected visually
        removeHighlights(); // Clear any lingering highlights
        // Optionally disable the board further?
    }

    function updateStatus() {
        if (!gameOver) {
            turnElement.textContent = currentPlayer === PLAYER1 ? "Red (You)" : "Black (Computer)";
        }
         // Could add piece count display here if desired
         // console.log(`Status - P1: ${player1Pieces}, P2: ${player2Pieces}, Turn: ${currentPlayer}, mustJump: ${mustJump}, multiJump: ${ongoingMultiJump}`);
    }

    function showMessage(msg) {
        // Only update message if game isn't over, or if it's the final win message
        if (!gameOver || msg.includes("wins!")) {
             messageElement.textContent = msg;
        }
    }

    function restartGame() {
        gameOver = false;
        currentPlayer = PLAYER1;
        selectedPiece = null;
        validMoves = [];
        player1Pieces = 12;
        player2Pieces = 12;
        mustJump = false;
        ongoingMultiJump = false;
        createBoard();
        renderBoard(); // This now calls updateStatus internally
        showMessage("Red's turn (You).");
    }

    // Initial setup
    restartButton.addEventListener('click', restartGame);
    createBoard();
    renderBoard();
    showMessage("Red's turn (You)."); // Initial message
    // Initial check for mandatory jump for Player 1 on first turn
    const initialMoves = getAllPossibleMoves(PLAYER1);
    mustJump = initialMoves.some(move => move.isJump);
    if (mustJump) {
        showMessage("Your turn - You must make a jump!");
    }

}); // End of DOMContentLoaded listener