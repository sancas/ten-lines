import { Box, Button } from "@mui/material";
import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type {
    ExtendedGeneratorState,
    ExtendedWildGeneratorState,
    FRLGContiguousSeedEntry,
} from "../tenLines/generated";
import fetchTenLines, { hexSeed, SEED_IDENTIFIER_TO_GAME } from "../tenLines";
import { GENDERS_EN, NATURES_EN } from "../tenLines/resources";
import type { CalibrationFormState } from "./CalibrationForm";
import { proxy } from "comlink";
import useLocalStorage from "../hooks/useLocalStorage";

export type BingoBoardEntry = ExtendedGeneratorState | ExtendedWildGeneratorState;

export function useBingoBoard() {
    const [bingoBoard, setBingoBoard] = useLocalStorage<BingoBoardEntry[][]>("bingo-board", []);
    const [counters, setCounters] = useLocalStorage<number[][]>("bingo-counters", []);
    return [bingoBoard, setBingoBoard, counters, setCounters] as const;
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

function SpriteImage({
    species,
    form,
    gender,
    shiny,
}: {
    species: number;
    form: number;
    gender: number;
    shiny: boolean;
}) {
    const [image, setImage] = useState("");
    let gender_string = "";
    if (gender === 1 && [521, 592, 593, 668].includes(species)) {
        gender_string = "female/";
    }
    const shiny_string = shiny ? "shiny/" : "";
    return (
        <img
            src={
                image ||
                `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${shiny_string}${gender_string}${species}.png`
            }
            alt=""
            loading="lazy"
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
        const reset: number[][] = counters.map((row: number[]) => row.map(() => 0));
        setCounters(reset);
    };

    const handleClearBoard = () => {
        setBingoBoard([]);
        setCounters([]);
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
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎯</div>
                <h2 style={{ margin: "0 0 0.5rem 0" }}>Tablero de Bingo</h2>
                <p style={{ color: "#94a3b8", maxWidth: 600, margin: "0 auto 1.5rem auto", lineHeight: 1.6 }}>
                    El modo Bingo está activo. Aún no se ha generado ningún tablero.
                    Para generarlo, dirígete a la pestaña <strong>Calibration</strong>,
                    configura tus parámetros de búsqueda de RNG y presiona el botón <strong>🎯 Generate Bingo Board</strong>.
                </p>
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
                >
                    Ir a Calibration
                </Button>
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

    return (
        <Box sx={{ width: "100%", my: 2, ...sx }}>
            {/* Barra de herramientas y estadísticas */}
            <Box
                sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1.5,
                    mb: 2,
                    p: 1.5,
                    bgcolor: "background.paper",
                    borderRadius: 1.5,
                    border: "1px solid",
                    borderColor: "divider",
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: "1.1rem" }}>🎯 Modo Bingo</span>
                    <span
                        style={{
                            backgroundColor: completedCells === totalCells && totalCells > 0 ? "#10b981" : "#334155",
                            color: "#fff",
                            padding: "4px 10px",
                            borderRadius: "12px",
                            fontSize: "0.85rem",
                            fontWeight: 600,
                        }}
                    >
                        Progreso: {completedCells} / {totalCells} ({totalCells > 0 ? Math.round((completedCells / totalCells) * 100) : 0}%)
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                        ({height} semillas × {width} avances)
                    </span>
                </Box>

                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        onClick={handleResetCounters}
                    >
                        Reiniciar Contadores (0)
                    </Button>
                    <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={handleClearBoard}
                    >
                        Limpiar Tablero
                    </Button>
                </Box>
            </Box>

            {/* Banner de ayuda rápida */}
            <Box
                sx={{
                    mb: 2,
                    px: 1.5,
                    py: 0.75,
                    fontSize: "0.82rem",
                    color: "#94a3b8",
                    bgcolor: "rgba(148, 163, 184, 0.08)",
                    borderRadius: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1,
                    flexWrap: "wrap",
                }}
            >
                <span>💡 <strong>Controles:</strong> Clic / Toque = +1</span>
                <span>•</span>
                <span>Clic derecho o botón [-] = -1</span>
                <span>•</span>
                <span>Clic central = -1</span>
            </Box>

            {/* Contenedor del tablero con scroll horizontal responsivo */}
            <Box
                sx={{
                    overflowX: "auto",
                    width: "100%",
                    pb: 2,
                }}
            >
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${width + 1}, minmax(105px, 1fr))`,
                        gap: 1.5,
                        minWidth: Math.max(500, (width + 1) * 115),
                    }}
                >
                    {Array.from({ length: (width + 1) * (height + 1) }, (_, i) => {
                        const [x, y] = [i % (width + 1), Math.floor(i / (width + 1))];
                        if (y === 0 && x === 0) {
                            return (
                                <Box
                                    key={i}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "0.75rem",
                                        color: "#94a3b8",
                                        fontWeight: 600,
                                    }}
                                >
                                    Seed \ Adv
                                </Box>
                            );
                        }
                        if (y === 0) {
                            return (
                                <Box
                                    key={i}
                                    sx={{
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        p: 1,
                                        bgcolor: "rgba(56, 189, 248, 0.1)",
                                        color: "#38bdf8",
                                        borderRadius: 1,
                                        fontWeight: 700,
                                        fontSize: "0.9rem",
                                    }}
                                >
                                    +{sanitizedBoard?.[0]?.[x - 1]?.advances}
                                </Box>
                            );
                        }
                        if (x === 0) {
                            return (
                                <Box
                                    key={i}
                                    sx={{
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        p: 1,
                                        bgcolor: "rgba(244, 114, 182, 0.1)",
                                        color: "#f472b6",
                                        borderRadius: 1,
                                        fontWeight: 700,
                                        fontSize: "0.85rem",
                                        fontFamily: "monospace",
                                    }}
                                >
                                    {hexSeed(
                                        sanitizedBoard?.[y - 1]?.[0]?.initialSeed ?? 0,
                                        16
                                    )}
                                </Box>
                            );
                        }
                        const entry = sanitizedBoard?.[y - 1]?.[x - 1];
                        const counter = counters?.[y - 1]?.[x - 1] ?? 0;
                        if (!entry) return null;

                        const isCompleted = counter > 0;

                        return (
                            <Box
                                key={i}
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    borderRadius: 1.5,
                                    overflow: "hidden",
                                    border: "1px solid",
                                    borderColor: isCompleted ? "#10b981" : "divider",
                                    boxShadow: isCompleted ? "0 0 10px rgba(16, 185, 129, 0.25)" : "none",
                                    transition: "all 0.15s ease-in-out",
                                }}
                            >
                                <Button
                                    variant="contained"
                                    color={isCompleted ? "success" : "inherit"}
                                    fullWidth
                                    sx={{
                                        p: 1,
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        lineHeight: 1.2,
                                        bgcolor: isCompleted ? undefined : "#1e293b",
                                        "&:hover": {
                                            bgcolor: isCompleted ? undefined : "#334155",
                                        },
                                        flexGrow: 1,
                                        minHeight: 110,
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
                                    <SpriteImage
                                        species={entry.species}
                                        form={entry.form}
                                        gender={entry.gender}
                                        shiny={entry.shiny !== 0}
                                    />
                                    <span style={{ fontSize: "0.75rem", marginTop: "2px", fontWeight: 600 }}>
                                        {GENDERS_EN[entry.gender]}{" "}
                                        {NATURES_EN[entry.nature]}
                                    </span>
                                    <span style={{ fontSize: "0.7rem", opacity: 0.85, marginTop: "1px" }}>
                                        {entry.stats.join("/")}
                                    </span>
                                </Button>

                                {/* Contador y controles directos (+ / -) */}
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        px: 1,
                                        py: 0.5,
                                        bgcolor: isCompleted ? "#065f46" : "#0f172a",
                                        borderTop: "1px solid",
                                        borderColor: isCompleted ? "#10b981" : "rgba(255,255,255,0.06)",
                                    }}
                                >
                                    <button
                                        type="button"
                                        style={{
                                            background: "rgba(255,255,255,0.15)",
                                            border: "none",
                                            borderRadius: "4px",
                                            color: "#fff",
                                            width: "22px",
                                            height: "22px",
                                            cursor: "pointer",
                                            fontSize: "0.9rem",
                                            fontWeight: "bold",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            padding: 0,
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
                                            fontSize: "0.85rem",
                                            color: isCompleted ? "#34d399" : "#94a3b8",
                                        }}
                                    >
                                        × {counter}
                                    </span>

                                    <button
                                        type="button"
                                        style={{
                                            background: "rgba(255,255,255,0.15)",
                                            border: "none",
                                            borderRadius: "4px",
                                            color: "#fff",
                                            width: "22px",
                                            height: "22px",
                                            cursor: "pointer",
                                            fontSize: "0.9rem",
                                            fontWeight: "bold",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            padding: 0,
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
