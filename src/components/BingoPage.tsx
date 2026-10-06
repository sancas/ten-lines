import {
    Box,
    Button,
    LinearProgress,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
} from "@mui/material";
import { useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import type {
    ExtendedGeneratorState,
    ExtendedWildGeneratorState,
    FRLGContiguousSeedEntry,
} from "../tenLines/generated";
import fetchTenLines, { hexSeed, SEED_IDENTIFIER_TO_GAME } from "../tenLines";
import { GENDERS_EN, NATURES_EN, getNameEn } from "../tenLines/resources";
import type { CalibrationFormState } from "./CalibrationForm";
import { proxy } from "comlink";
import useLocalStorage from "../hooks/useLocalStorage";
import { GAME_LABELS, CONSOLE_LABELS, useGameSettings } from "../hooks/useGameSettings";

export type BingoBoardEntry = ExtendedGeneratorState | ExtendedWildGeneratorState;

export interface BingoMetadata {
    game: string;
    gameConsole: string;
    createdAt?: number;
}

export function useBingoBoard() {
    const [bingoBoard, setBingoBoard] = useLocalStorage<BingoBoardEntry[][]>("bingo-board", []);
    const [counters, setCounters] = useLocalStorage<number[][]>("bingo-counters", []);
    return [bingoBoard, setBingoBoard, counters, setCounters] as const;
}

export function useBingoMetadata() {
    return useLocalStorage<BingoMetadata | null>("bingo-metadata", null);
}

export function getBingoActive() {
    const [searchParams] = useSearchParams();
    return searchParams.get("bingo") !== "false";
}

export async function fetchBingo(
    searchSeeds: FRLGContiguousSeedEntry[],
    advancesRange: number[],
    offset: string,
    isStatic: boolean,
    trainerID: string,
    secretID: string,
    game: string,
    calibrationFormState: CalibrationFormState,
    setBingoBoard: (
        val: BingoBoardEntry[][] | ((val: BingoBoardEntry[][]) => BingoBoardEntry[][])
    ) => void,
    setBingoCounters: (
        val: number[][] | ((val: number[][]) => number[][])
    ) => void
) {
    const tenLines = await fetchTenLines();
    const allBoardRows: BingoBoardEntry[][] = [];
    const allCounterRows: number[][] = [];
    const seenSeeds = new Set<number>();

    setBingoBoard([]);
    setBingoCounters([]);

    const doneCallback = () => {};
    const resultCallback = (results: BingoBoardEntry[]) => {
        if (!results || results.length === 0) return;
        const seed = results[0].initialSeed;
        if (seenSeeds.has(seed)) {
            return;
        }
        seenSeeds.add(seed);

        allBoardRows.push(results);
        allCounterRows.push(results.map(() => 0));

        setBingoBoard([...allBoardRows]);
        setBingoCounters([...allCounterRows]);
    };
    if (isStatic) {
        await tenLines.check_seeds_static(
            searchSeeds,
            advancesRange,
            [0, 0],
            parseInt(offset),
            SEED_IDENTIFIER_TO_GAME[game],
            parseInt(trainerID),
            parseInt(secretID),
            calibrationFormState.staticCategory,
            calibrationFormState.staticPokemon,
            calibrationFormState.method,
            255,
            -1,
            -1,
            [
                [0, 31],
                [0, 31],
                [0, 31],
                [0, 31],
                [0, 31],
                [0, 31],
            ],
            proxy(resultCallback),
            proxy(doneCallback)
        );
    } else {
        await tenLines.check_seeds_wild(
            searchSeeds,
            advancesRange,
            [0, 0],
            parseInt(offset),
            SEED_IDENTIFIER_TO_GAME[game],
            parseInt(trainerID),
            parseInt(secretID),
            calibrationFormState.wildCategory,
            calibrationFormState.wildLocation,
            !calibrationFormState.shouldFilterPokemon
                ? -1
                : calibrationFormState.wildPokemon,
            calibrationFormState.method,
            calibrationFormState.wildLead,
            255,
            -1,
            -1,
            [
                [0, 31],
                [0, 31],
                [0, 31],
                [0, 31],
                [0, 31],
                [0, 31],
            ],
            proxy(resultCallback),
            proxy(doneCallback)
        );
    }
}

export type BoardDensity = "auto" | "compact" | "normal" | "large";

function SpriteImage({
    species,
    form,
    gender,
    shiny,
    size = 64,
}: {
    species: number;
    form: number;
    gender: number;
    shiny: boolean;
    size?: number | string;
}) {
    const [image, setImage] = useState("");
    let gender_string = "";
    if (gender === 1 && [521, 592, 593, 668].includes(species)) {
        gender_string = "female/";
    }
    const shiny_string = shiny ? "shiny/" : "";
    return (
        <img
            className="pixel-art"
            src={
                image ||
                `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${shiny_string}${gender_string}${species}.png`
            }
            alt=""
            loading="lazy"
            style={{
                width: size,
                height: size,
                imageRendering: "pixelated",
                objectFit: "contain",
                filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.35))",
                transition: "transform 0.15s ease",
            }}
            onError={() =>
                setImage(
                    `https://github.com/projectadd/pokemon-sprites/blob/master/icons/${
                        shiny ? "shiny/" : ""
                    }${species.toString().padStart(3, "0")}${
                        form ? "-" + form : ""
                    }.gif?raw=true`
                )
            }
        />
    );
}

export default function BingoPage({
    sx,
    hidden,
}: {
    sx?: any;
    hidden?: boolean;
}) {
    const [, setSearchParams] = useSearchParams();
    const [bingoBoard, setBingoBoard, counters, setCounters] = useBingoBoard();
    const [bingoMetadata, setBingoMetadata] = useBingoMetadata();
    const { game: activeGame, gameConsole: activeConsole } = useGameSettings();
    const [boardDensity, setBoardDensity] = useLocalStorage<BoardDensity>("bingo-board-density", "auto");
    const [isFullWidth, setIsFullWidth] = useLocalStorage<boolean>("bingo-full-width", false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const boardContainerRef = useRef<HTMLDivElement>(null);

    // Fullscreen change listener
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
        };
    }, []);

    const toggleFullscreen = async () => {
        try {
            if (!document.fullscreenElement) {
                if (boardContainerRef.current?.requestFullscreen) {
                    await boardContainerRef.current.requestFullscreen();
                } else if (document.documentElement.requestFullscreen) {
                    await document.documentElement.requestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                }
            }
        } catch (err) {
            console.error("Fullscreen error:", err);
        }
    };

    // Deduplicate any consecutive or repeated seed rows by initialSeed
    const sanitizedBoard = useMemo(() => {
        const seen = new Set<number>();
        const unique: BingoBoardEntry[][] = [];
        for (const row of bingoBoard ?? []) {
            if (!row || row.length === 0) continue;
            const seed = row[0].initialSeed;
            if (!seen.has(seed)) {
                seen.add(seed);
                unique.push(row);
            }
        }
        return unique;
    }, [bingoBoard]);

    // Automatically synchronize stored board if it contained duplicates
    useEffect(() => {
        if (bingoBoard && sanitizedBoard.length !== bingoBoard.length) {
            setBingoBoard(sanitizedBoard);
        }
    }, [sanitizedBoard, bingoBoard, setBingoBoard]);

    if (hidden) return null;

    const width = sanitizedBoard[0]?.length ?? 0;
    const height = sanitizedBoard.length;
    const isEmpty = height === 0 || width === 0;

    const handleIncrement = (y: number, x: number) => {
        const newCounters: number[][] = counters ? counters.map((row: number[]) => [...row]) : [];
        if (!newCounters[y]) newCounters[y] = [];
        newCounters[y][x] = (newCounters[y][x] ?? 0) + 1;
        setCounters(newCounters);
    };

    const handleDecrement = (y: number, x: number) => {
        const newCounters: number[][] = counters ? counters.map((row: number[]) => [...row]) : [];
        if (!newCounters[y]) return;
        newCounters[y][x] = Math.max(0, (newCounters[y][x] ?? 0) - 1);
        setCounters(newCounters);
    };

    const handleResetCounters = () => {
        if (!counters) return;
        if (window.confirm("¿Seguro que deseas reiniciar todos los contadores a 0?")) {
            const reset: number[][] = counters.map((row: number[]) => row.map(() => 0));
            setCounters(reset);
        }
    };

    const handleClearBoard = () => {
        if (window.confirm("¿Seguro que deseas borrar el tablero por completo para buscar un nuevo objetivo o cambiar de juego/consola?")) {
            setBingoBoard([]);
            setCounters([]);
            setBingoMetadata(null);
        }
    };

    if (isEmpty) {
        return (
            <Box
                sx={{
                    my: 4,
                    p: 4,
                    textAlign: "center",
                    bgcolor: "background.paper",
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    ...sx,
                }}
            >
                <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>🎯</div>
                <h2 style={{ margin: "0 0 0.5rem 0", fontSize: "1.8rem" }}>Tablero de Bingo RNG</h2>

                <Box sx={{ mb: 2 }}>
                    <Box
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 1,
                            bgcolor: "rgba(56, 189, 248, 0.1)",
                            border: "1px solid rgba(56, 189, 248, 0.25)",
                            px: 2,
                            py: 0.6,
                            borderRadius: 2,
                        }}
                    >
                        <span style={{ fontSize: "0.9rem", color: "#38bdf8", fontWeight: 700 }}>
                            Juego configurado: {GAME_LABELS[activeGame] ?? activeGame} • Consola: {CONSOLE_LABELS[activeConsole] ?? activeConsole}
                        </span>
                    </Box>
                </Box>

                <p style={{ color: "#94a3b8", maxWidth: 650, margin: "0 auto 1.5rem auto", lineHeight: 1.6 }}>
                    El modo Bingo está activo. No hay ningún tablero generado actualmente.
                    Puedes buscar un objetivo en <strong>Searcher</strong> o dirigirte a <strong>Calibration</strong> para calibrar y presionar <strong>🎯 Generate Bingo Board</strong>.
                </p>
                <Box sx={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
                    <Button
                        variant="outlined"
                        color="primary"
                        size="large"
                        onClick={() => {
                            setSearchParams((prev) => {
                                prev.set("page", "2");
                                return prev;
                            });
                        }}
                        sx={{ px: 3, py: 1.2, fontWeight: 700 }}
                    >
                        🔍 1. Ir a Searcher (Buscar Objetivo)
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        size="large"
                        onClick={() => {
                            setSearchParams((prev) => {
                                prev.set("page", "1");
                                return prev;
                            });
                        }}
                        sx={{ px: 3, py: 1.2, fontWeight: 700 }}
                    >
                        ⚙️ 2. Ir a Calibration (Generar Tablero) →
                    </Button>
                </Box>
            </Box>
        );
    }

    const totalCells = width * height;
    let completedCells = 0;
    if (counters) {
        for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
                if ((counters[r]?.[c] ?? 0) > 0) completedCells++;
            }
        }
    }

    const progressPercentage = totalCells > 0 ? Math.round((completedCells / totalCells) * 100) : 0;
    const remainingCells = totalCells - completedCells;

    // Responsive dimensions based on selected density
    const colMinWidth = {
        compact: "98px",
        normal: "135px",
        large: "185px",
        auto: "clamp(115px, 8.5vw, 195px)",
    }[boardDensity];

    const spriteSize = {
        compact: 42,
        normal: 58,
        large: 84,
        auto: "clamp(50px, 4.2vw, 82px)",
    }[boardDensity];

    const minCellHeight = {
        compact: 100,
        normal: 130,
        large: 175,
        auto: 135,
    }[boardDensity];

    return (
        <Box
            sx={{
                width: "100%",
                maxWidth: isFullWidth ? "100% !important" : undefined,
                my: 2,
                transition: "max-width 0.25s ease-in-out",
                ...sx,
            }}
        >
            {/* Barra de herramientas, controles y estadísticas */}
            <Box
                sx={{
                    mb: 2,
                    p: { xs: 1.5, sm: 2 },
                    bgcolor: "background.paper",
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.5,
                }}
            >
                {/* Fila superior: Título, Estadísticas y Acciones */}
                <Box
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1.5,
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: "1.25rem", letterSpacing: "-0.01em" }}>
                            🎯 Tablero Bingo
                        </span>
                        {(bingoMetadata?.game || activeGame) && (
                            <Box
                                sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 0.8,
                                    backgroundColor: "rgba(56, 189, 248, 0.12)",
                                    color: "#38bdf8",
                                    border: "1px solid rgba(56, 189, 248, 0.3)",
                                    px: 1.5,
                                    py: 0.3,
                                    borderRadius: "14px",
                                    fontSize: "0.83rem",
                                    fontWeight: 700,
                                }}
                            >
                                🎮 {GAME_LABELS[bingoMetadata?.game ?? activeGame] ?? (bingoMetadata?.game ?? activeGame)}
                                {" • "}
                                {CONSOLE_LABELS[bingoMetadata?.gameConsole ?? activeConsole] ?? (bingoMetadata?.gameConsole ?? activeConsole)}
                            </Box>
                        )}
                        <span
                            style={{
                                backgroundColor: completedCells === totalCells && totalCells > 0 ? "#10b981" : "#1e293b",
                                color: completedCells === totalCells && totalCells > 0 ? "#fff" : "#38bdf8",
                                border: "1px solid",
                                borderColor: completedCells === totalCells && totalCells > 0 ? "#10b981" : "#38bdf8",
                                padding: "4px 12px",
                                borderRadius: "14px",
                                fontSize: "0.85rem",
                                fontWeight: 700,
                            }}
                        >
                            {completedCells} / {totalCells} ({progressPercentage}%)
                        </span>
                        <span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
                            • {remainingCells} restantes
                        </span>
                        <span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
                            • {height} semillas × {width} avances
                        </span>
                    </Box>

                    {/* Botones de acción */}
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
                        <Button
                            size="small"
                            variant="outlined"
                            color="primary"
                            onClick={() => {
                                setSearchParams((prev) => {
                                    prev.set("page", "2");
                                    return prev;
                                });
                            }}
                            title="Ir al buscador para buscar otro Pokémon objetivo"
                        >
                            🔍 Buscar (Searcher)
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            color="secondary"
                            onClick={() => {
                                setSearchParams((prev) => {
                                    prev.set("page", "1");
                                    return prev;
                                });
                            }}
                            title="Ir a calibración para configurar o regenerar tablero"
                        >
                            ⚙️ Calibración
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            color="inherit"
                            onClick={handleResetCounters}
                            title="Reiniciar todos los contadores de las casillas a 0"
                        >
                            ↺ Reiniciar (0)
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={handleClearBoard}
                            title="Eliminar este tablero por completo para empezar uno nuevo"
                        >
                            🗑️ Borrar Tablero
                        </Button>
                    </Box>
                </Box>

                {/* Barra de progreso visual con degradado suave */}
                <Box sx={{ width: "100%" }}>
                    <LinearProgress
                        variant="determinate"
                        value={progressPercentage}
                        sx={{
                            height: 8,
                            borderRadius: 4,
                            bgcolor: "rgba(255, 255, 255, 0.08)",
                            "& .MuiLinearProgress-bar": {
                                borderRadius: 4,
                                background: completedCells === totalCells && totalCells > 0
                                    ? "linear-gradient(90deg, #10b981, #34d399)"
                                    : "linear-gradient(90deg, #0284c7, #38bdf8)",
                            },
                        }}
                    />
                </Box>

                {/* Fila inferior: Controles de vista, densidad y pantalla grande / 4K */}
                <Box
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1.5,
                        pt: 0.5,
                        borderTop: "1px solid",
                        borderColor: "rgba(255, 255, 255, 0.06)",
                    }}
                >
                    {/* Selector de Tamaño de Casilla */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.82rem", color: "#94a3b8", fontWeight: 600 }}>
                            Tamaño del Tablero:
                        </span>
                        <ToggleButtonGroup
                            size="small"
                            value={boardDensity}
                            exclusive
                            onChange={(_, val) => val && setBoardDensity(val)}
                            sx={{
                                "& .MuiToggleButton-root": {
                                    px: 1.2,
                                    py: 0.4,
                                    fontSize: "0.78rem",
                                    fontWeight: 600,
                                    textTransform: "none",
                                },
                            }}
                        >
                            <ToggleButton value="auto" title="Se ajusta fluidamente al ancho de tu pantalla">
                                📱 Auto
                            </ToggleButton>
                            <ToggleButton value="compact" title="Casillas compactas (100px) para ver muchas columnas">
                                Compacto
                            </ToggleButton>
                            <ToggleButton value="normal" title="Casillas estándar (135px)">
                                Normal
                            </ToggleButton>
                            <ToggleButton value="large" title="Casillas grandes (185px) con sprites HD, ideal para monitores 4K">
                                🖥️ 4K / Grande
                            </ToggleButton>
                        </ToggleButtonGroup>
                    </Box>

                    {/* Modos de Pantalla y Ancho */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <Tooltip title="Aprovecha el 100% de la pantalla sin márgenes en monitores grandes y 4K">
                            <Button
                                size="small"
                                variant={isFullWidth ? "contained" : "outlined"}
                                color={isFullWidth ? "primary" : "inherit"}
                                onClick={() => setIsFullWidth(!isFullWidth)}
                                sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.8rem" }}
                            >
                                {isFullWidth ? "⇥ Ancho Completo: Sí" : "↔ Ancho Estándar"}
                            </Button>
                        </Tooltip>

                        <Tooltip title="Activar / Salir de pantalla completa">
                            <Button
                                size="small"
                                variant="outlined"
                                color="inherit"
                                onClick={toggleFullscreen}
                                sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.8rem" }}
                            >
                                {isFullscreen ? "🗗 Salir" : "⛶ Pantalla Completa"}
                            </Button>
                        </Tooltip>
                    </Box>
                </Box>
            </Box>

            {/* Banner de ayuda rápida interactivo */}
            <Box
                sx={{
                    mb: 2,
                    px: 2,
                    py: 1,
                    fontSize: "0.82rem",
                    color: "#94a3b8",
                    bgcolor: "rgba(148, 163, 184, 0.08)",
                    borderRadius: 1.5,
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1.5,
                    flexWrap: "wrap",
                }}
            >
                <span>💡 <strong>Clic / Toque</strong> = Sumar (+1)</span>
                <span>•</span>
                <span><strong>Clic derecho</strong> / <strong>Botón [-]</strong> = Restar (-1)</span>
                <span>•</span>
                <span><strong>Encabezados fijos:</strong> No perderás de vista la Semilla ni los Avances al desplazarte</span>
            </Box>

            {/* Contenedor del tablero con encabezados fijos (Sticky) y scroll optimizado */}
            <Box
                ref={boardContainerRef}
                sx={{
                    overflow: "auto",
                    width: "100%",
                    maxHeight: isFullscreen ? "100vh" : "calc(100vh - 200px)",
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: "#0b0f17",
                    position: "relative",
                    p: 1.5,
                    boxShadow: "inset 0 0 15px rgba(0,0,0,0.5)",
                }}
            >
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${width + 1}, minmax(${colMinWidth}, 1fr))`,
                        gap: 1.25,
                        width: "max-content",
                        minWidth: "100%",
                    }}
                >
                    {Array.from({ length: (width + 1) * (height + 1) }, (_, i) => {
                        const [x, y] = [i % (width + 1), Math.floor(i / (width + 1))];

                        // Esquina superior izquierda (fija en X e Y)
                        if (y === 0 && x === 0) {
                            return (
                                <Box
                                    key={i}
                                    sx={{
                                        position: "sticky",
                                        top: 0,
                                        left: 0,
                                        zIndex: 30,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "0.8rem",
                                        color: "#cbd5e1",
                                        fontWeight: 700,
                                        bgcolor: "#161f2e",
                                        borderRadius: 1.5,
                                        p: 1,
                                        border: "1px solid",
                                        borderColor: "divider",
                                        boxShadow: "2px 2px 8px rgba(0,0,0,0.4)",
                                    }}
                                >
                                    Seed \ Adv
                                </Box>
                            );
                        }

                        // Encabezado de Avances (Fila superior fija)
                        if (y === 0) {
                            return (
                                <Box
                                    key={i}
                                    sx={{
                                        position: "sticky",
                                        top: 0,
                                        zIndex: 20,
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        p: 1,
                                        bgcolor: "#161f2e",
                                        color: "#38bdf8",
                                        borderRadius: 1.5,
                                        fontWeight: 700,
                                        fontSize: boardDensity === "large" ? "1rem" : "0.88rem",
                                        border: "1px solid rgba(56, 189, 248, 0.3)",
                                        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                                        backdropFilter: "blur(8px)",
                                    }}
                                >
                                    +{sanitizedBoard?.[0]?.[x - 1]?.advances}
                                </Box>
                            );
                        }

                        // Columna de Semillas (Columna izquierda fija)
                        if (x === 0) {
                            return (
                                <Box
                                    key={i}
                                    sx={{
                                        position: "sticky",
                                        left: 0,
                                        zIndex: 15,
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        p: 1,
                                        bgcolor: "#161f2e",
                                        color: "#f472b6",
                                        borderRadius: 1.5,
                                        fontWeight: 700,
                                        fontSize: boardDensity === "large" ? "0.95rem" : "0.82rem",
                                        fontFamily: "monospace",
                                        border: "1px solid rgba(244, 114, 182, 0.3)",
                                        boxShadow: "2px 0 6px rgba(0,0,0,0.3)",
                                        backdropFilter: "blur(8px)",
                                    }}
                                >
                                    {hexSeed(
                                        sanitizedBoard?.[y - 1]?.[0]?.initialSeed ?? 0,
                                        16
                                    )}
                                </Box>
                            );
                        }

                        // Casilla del Pokemon
                        const entry = sanitizedBoard?.[y - 1]?.[x - 1];
                        const counter = counters?.[y - 1]?.[x - 1] ?? 0;
                        if (!entry) return null;

                        const isCompleted = counter > 0;
                        const isShiny = entry.shiny !== 0;
                        const pokemonName = getNameEn(entry.species, entry.form);

                        return (
                            <Box
                                key={i}
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    borderRadius: 1.5,
                                    overflow: "hidden",
                                    border: "2px solid",
                                    borderColor: isCompleted ? "#10b981" : "rgba(255, 255, 255, 0.08)",
                                    boxShadow: isCompleted
                                        ? "0 0 14px rgba(16, 185, 129, 0.35)"
                                        : "0 2px 6px rgba(0,0,0,0.2)",
                                    bgcolor: isCompleted ? "rgba(16, 185, 129, 0.08)" : "#161f2e",
                                    transition: "all 0.15s ease-in-out",
                                    "&:hover": {
                                        borderColor: isCompleted ? "#34d399" : "#38bdf8",
                                        transform: "translateY(-2px)",
                                        boxShadow: "0 6px 16px rgba(0,0,0,0.4)",
                                    },
                                }}
                            >
                                <Button
                                    variant="text"
                                    color="inherit"
                                    fullWidth
                                    sx={{
                                        p: boardDensity === "compact" ? 0.75 : boardDensity === "large" ? 1.5 : 1,
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        lineHeight: 1.2,
                                        bgcolor: isCompleted ? "rgba(16, 185, 129, 0.14)" : "transparent",
                                        flexGrow: 1,
                                        minHeight: minCellHeight,
                                        position: "relative",
                                    }}
                                    onClick={() => handleIncrement(y - 1, x - 1)}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        handleDecrement(y - 1, x - 1);
                                    }}
                                    onMouseDown={(e) => {
                                        if (e.button === 1) {
                                            e.preventDefault();
                                            handleDecrement(y - 1, x - 1);
                                        }
                                    }}
                                >
                                    {/* Insignia de Completado */}
                                    {isCompleted && (
                                        <Box
                                            sx={{
                                                position: "absolute",
                                                top: 4,
                                                right: 4,
                                                bgcolor: "#10b981",
                                                color: "#fff",
                                                borderRadius: "50%",
                                                width: 18,
                                                height: 18,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "0.7rem",
                                                fontWeight: "bold",
                                            }}
                                        >
                                            ✓
                                        </Box>
                                    )}

                                    {/* Indicador Shiny si aplica */}
                                    {isShiny && (
                                        <Box
                                            sx={{
                                                fontSize: "0.68rem",
                                                fontWeight: 800,
                                                color: "#fbbf24",
                                                textShadow: "0 0 8px rgba(251, 191, 36, 0.6)",
                                                letterSpacing: "0.05em",
                                                mb: 0.25,
                                            }}
                                        >
                                            ✨ SHINY
                                        </Box>
                                    )}

                                    {/* Sprite en Pixel Art nítido */}
                                    <SpriteImage
                                        species={entry.species}
                                        form={entry.form}
                                        gender={entry.gender}
                                        shiny={isShiny}
                                        size={spriteSize}
                                    />

                                    {/* Nombre del Pokemon */}
                                    <div
                                        style={{
                                            fontSize: boardDensity === "large" ? "0.95rem" : "0.78rem",
                                            fontWeight: 700,
                                            marginTop: "3px",
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            maxWidth: "100%",
                                            color: isCompleted ? "#34d399" : "#f1f5f9",
                                        }}
                                        title={pokemonName}
                                    >
                                        {pokemonName}
                                    </div>

                                    {/* Género y Naturaleza */}
                                    <span
                                        style={{
                                            fontSize: boardDensity === "large" ? "0.82rem" : "0.72rem",
                                            marginTop: "2px",
                                            fontWeight: 600,
                                            color: "#94a3b8",
                                        }}
                                    >
                                        {GENDERS_EN[entry.gender]} {NATURES_EN[entry.nature]}
                                    </span>

                                    {/* IVs con destaque en 31s */}
                                    <Box
                                        sx={{
                                            fontSize: boardDensity === "large" ? "0.78rem" : "0.68rem",
                                            marginTop: "2px",
                                            opacity: 0.9,
                                            fontFamily: "monospace",
                                        }}
                                    >
                                        {entry.stats.map((iv, idx) => (
                                            <span
                                                key={idx}
                                                style={{
                                                    color: iv === 31 ? "#34d399" : "#cbd5e1",
                                                    fontWeight: iv === 31 ? 800 : 400,
                                                }}
                                            >
                                                {iv}{idx < 5 ? "/" : ""}
                                            </span>
                                        ))}
                                    </Box>
                                </Button>

                                {/* Barra inferior con contador y botones directos (+ / -) */}
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        px: 1,
                                        py: 0.5,
                                        bgcolor: isCompleted ? "#064e3b" : "#0f172a",
                                        borderTop: "1px solid",
                                        borderColor: isCompleted ? "#10b981" : "rgba(255,255,255,0.06)",
                                    }}
                                >
                                    <button
                                        type="button"
                                        style={{
                                            background: "rgba(255,255,255,0.12)",
                                            border: "none",
                                            borderRadius: "4px",
                                            color: "#fff",
                                            width: boardDensity === "large" ? "28px" : "22px",
                                            height: boardDensity === "large" ? "28px" : "22px",
                                            cursor: "pointer",
                                            fontSize: boardDensity === "large" ? "1.1rem" : "0.9rem",
                                            fontWeight: "bold",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            padding: 0,
                                            transition: "background 0.15s ease",
                                        }}
                                        title="Restar (-1)"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDecrement(y - 1, x - 1);
                                        }}
                                    >
                                        -
                                    </button>

                                    <span
                                        style={{
                                            fontWeight: 700,
                                            fontSize: boardDensity === "large" ? "0.95rem" : "0.82rem",
                                            color: isCompleted ? "#34d399" : "#94a3b8",
                                        }}
                                    >
                                        × {counter}
                                    </span>

                                    <button
                                        type="button"
                                        style={{
                                            background: isCompleted ? "#10b981" : "rgba(255,255,255,0.12)",
                                            border: "none",
                                            borderRadius: "4px",
                                            color: "#fff",
                                            width: boardDensity === "large" ? "28px" : "22px",
                                            height: boardDensity === "large" ? "28px" : "22px",
                                            cursor: "pointer",
                                            fontSize: boardDensity === "large" ? "1.1rem" : "0.9rem",
                                            fontWeight: "bold",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            padding: 0,
                                            transition: "background 0.15s ease",
                                        }}
                                        title="Sumar (+1)"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleIncrement(y - 1, x - 1);
                                        }}
                                    >
                                        +
                                    </button>
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            </Box>
        </Box>
    );
}

