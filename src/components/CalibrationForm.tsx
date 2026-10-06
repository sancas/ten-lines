import { useEffect, useMemo, useState } from "react";

import {
    Autocomplete,
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogContent,
    FormControlLabel,
    MenuItem,
    TextField,
} from "@mui/material";

import fetchTenLines, {
    COMBINED_WILD_METHOD,
    fetchSeedData,
    frameToMS,
    hexSeed,
    SEED_IDENTIFIER_TO_GAME,
    STATIC_2,
    STATIC_4,
} from "../tenLines";
import NumericalInput from "./NumericalInput";
import RangeInput from "./RangeInput";
import { proxy } from "comlink";
import CalibrationTable from "./CalibrationTable";
import {
    type ExtendedGeneratorState,
    type ExtendedWildGeneratorState,
    type FRLGContiguousSeedEntry,
} from "../tenLines/generated";
import React from "react";
import { GENDERS_EN, METHODS_EN, NATURES_EN } from "../tenLines/resources";
import IvEntry from "./IvEntry";
import IvCalculator from "./IvCalculator";
import StaticEncounterSelector from "./StaticEncounterSelector";
import { useSearchParams } from "react-router-dom";
import WildEncounterSelector from "./WildEncounterSelector";
import { fetchBingo, getBingoActive, useBingoBoard, useBingoMetadata } from "./BingoPage";
import useLocalStorage from "../hooks/useLocalStorage";
import useGameSettings from "../hooks/useGameSettings";
import GameConsoleSelector from "./GameConsoleSelector";

export interface CalibrationFormState {
    seedLeewayString: string;
    shininess: number;
    nature: number;
    gender: number;
    ivRangeStrings: [string, string][];
    ivCalculatorText: string;
    staticCategory: number;
    staticPokemon: number;
    wildCategory: number;
    wildLocation: number;
    wildPokemon: number;
    wildLead: number;
    shouldFilterPokemon: boolean;
    method: number;
}

export interface CalibrationURLState {
    sound: string;
    buttonMode: string;
    button: string;
    heldButton: string;
    targetInitialSeed: string;
    advancesMin: string;
    advancesMax: string;
    ttvAdvancesMin: string;
    ttvAdvancesMax: string;
    offset: string;
    overworldFrames: string;
    teachyTVMode: string;
}

function useCalibrationURLState(gameConsole: string) {
    const [searchParams, setSearchParams] = useSearchParams();
    const [savedURLState, setSavedURLState] = useLocalStorage<Partial<CalibrationURLState>>(
        "calibration-url-state",
        {}
    );

    const sound = searchParams.get("sound") || savedURLState.sound || "mono";
    const buttonMode = searchParams.get("buttonMode") || savedURLState.buttonMode || "a";
    const button = searchParams.get("button") || savedURLState.button || "a";
    const heldButton = searchParams.get("heldButton") || savedURLState.heldButton || "none";
    const advancesMin = searchParams.get("advancesMin") || savedURLState.advancesMin || "0";
    const advancesMax = searchParams.get("advancesMax") || savedURLState.advancesMax || "100";
    const ttvAdvancesMin = searchParams.get("ttvAdvancesMin") || savedURLState.ttvAdvancesMin || "0";
    const ttvAdvancesMax = searchParams.get("ttvAdvancesMax") || savedURLState.ttvAdvancesMax || "100";
    const offset = searchParams.get("offset") || savedURLState.offset || "0";
    const overworldFrames = gameConsole.startsWith("NX")
        ? searchParams.get("overworldFrames") || savedURLState.overworldFrames || "600"
        : "0";
    const teachyTVMode = !gameConsole.startsWith("NX")
        ? searchParams.get("teachyTVMode") || savedURLState.teachyTVMode || "false"
        : "false";
    const targetSeedValue =
        parseInt(searchParams.get("targetInitialSeed") || savedURLState.targetInitialSeed || "DEAD", 16) ?? 0xdead;

    const setCalibrationURLState = (state: Partial<CalibrationURLState>) => {
        setSavedURLState((prev) => ({ ...prev, ...state }));
        setSearchParams((prev) => {
            for (const [key, value] of Object.entries(state)) {
                prev.set(key, value);
            }
            return prev;
        });
    };
    return {
        sound,
        buttonMode,
        button,
        heldButton,
        targetSeedValue,
        advancesMin,
        advancesMax,
        ttvAdvancesMin,
        ttvAdvancesMax,
        offset,
        overworldFrames,
        teachyTVMode,
        setCalibrationURLState,
    };
}

const defaultCalibrationFormState: CalibrationFormState = {
    seedLeewayString: "20",
    shininess: 255,
    nature: -1,
    gender: 255,
    ivRangeStrings: [
        ["0", "31"],
        ["0", "31"],
        ["0", "31"],
        ["0", "31"],
        ["0", "31"],
        ["0", "31"],
    ],
    ivCalculatorText: "",
    staticCategory: 0,
    staticPokemon: 0,
    wildCategory: 0,
    wildLocation: 0,
    wildPokemon: 0,
    wildLead: 255,
    shouldFilterPokemon: false,
    method: 1,
};

export default function CalibrationForm({
    sx,
    hidden,
}: {
    sx?: any;
    hidden?: boolean;
}) {
    const [calibrationFormState, setCalibrationFormState] =
        useLocalStorage<CalibrationFormState>(
            "calibration-form-state",
            defaultCalibrationFormState
        );

    const {
        game,
        gameConsole,
        trainerID,
        secretID,
        isSwitch,
        isFRLG,
        isFRLGE,
        setGame,
        setGameConsole,
        setTrainerID,
        setSecretID,
    } = useGameSettings();

    const [, setBingoMetadata] = useBingoMetadata();

    const {
        sound,
        buttonMode,
        button,
        heldButton,
        targetSeedValue,
        advancesMin,
        advancesMax,
        ttvAdvancesMin,
        ttvAdvancesMax,
        offset,
        overworldFrames,
        teachyTVMode,
        setCalibrationURLState,
    } = useCalibrationURLState(gameConsole);

    const [, setSearchParams] = useSearchParams();
    const [_bingoBoard, setBingoBoard, _bingoCounters, setBingoCounters] =
        useBingoBoard();

    const bingoActive = getBingoActive();
    const [bingoLoading, setBingoLoading] = useState(false);
    const [bingoSuccess, setBingoSuccess] = useState(false);

    const isStatic = calibrationFormState.method <= STATIC_4;

    const [rows, setRows] = useState<
        ExtendedGeneratorState[] | ExtendedWildGeneratorState[]
    >([]);
    const [searching, setSearching] = useState(false);

    const [seedLeewayIsValid, setSeedLeewayIsValid] = useState(true);
    const seedLeeway = seedLeewayIsValid
        ? parseInt(calibrationFormState.seedLeewayString, 10)
        : 0;
    const [advancesRangeIsValid, setAdvancesRangeIsValid] = useState(true);
    const advancesRange = advancesRangeIsValid
        ? [parseInt(advancesMin, 10), parseInt(advancesMax, 10)]
        : [0, 0];
    const isTeachyTVMode = teachyTVMode === "true" && isFRLG;
    const [ttvAdvancesRangeIsValid, setTTVAdvancesRangeIsValid] =
        useState(true);
    const ttvAdvancesRange = !isTeachyTVMode
        ? [0, 0]
        : ttvAdvancesRangeIsValid
            ? [parseInt(ttvAdvancesMin, 10), parseInt(ttvAdvancesMax, 10)]
            : [0, 0];
    const [ivRangesAreValid, setIvRangesAreValid] = useState(true);
    const [offsetIsValid, setOffsetIsValid] = useState(true);
    const [overworldFramesIsValid, setOverworldFramesIsValid] = useState(true);
    const ivRanges =
        calibrationFormState.nature == -1
            ? [
                [0, 31],
                [0, 31],
                [0, 31],
                [0, 31],
                [0, 31],
                [0, 31],
            ]
            : ivRangesAreValid
                ? calibrationFormState.ivRangeStrings.map((range) => [
                    parseInt(range[0], 10),
                    parseInt(range[1], 10),
                ])
                : [];

    const [trainerIDIsValid, setTrainerIDIsValid] = useState(true);
    const [secretIDIsValid, setSecretIDIsValid] = useState(true);

    const [seedList, setSeedList] = useState<FRLGContiguousSeedEntry[]>([]);
    const [seedDialogOpen, setSeedDialogOpen] = useState(false);

    const isNotSubmittable =
        searching ||
        seedList.length === 0 ||
        !trainerIDIsValid ||
        !secretIDIsValid ||
        !seedLeewayIsValid ||
        !advancesRangeIsValid ||
        (isTeachyTVMode && !ttvAdvancesRangeIsValid) ||
        !ivRangesAreValid ||
        !offsetIsValid ||
        !overworldFramesIsValid;

    useEffect(() => {
        const fetchSeedList = async () => {
            if (!isFRLG) {
                setSeedList(
                    [...Array(0x10000).keys()].map((seed) => ({
                        initialSeed: seed,
                        seedTime: seed * 16,
                    }))
                );
                return;
            }
            try {
                const seedData = await fetchSeedData(game);
                const tenLines = await fetchTenLines();
                const seedList = await tenLines.get_contiguous_seed_list(
                    seedData,
                    `${sound}_${buttonMode}_${button}`,
                    game,
                    heldButton
                );
                setSeedList(seedList);
                if (
                    seedList.findIndex(
                        (seed: FRLGContiguousSeedEntry) =>
                            seed.initialSeed === targetSeedValue
                    ) === -1
                ) {
                    setCalibrationURLState({
                        targetInitialSeed: hexSeed(
                            seedList.length > 0
                                ? seedList[Math.min(51, seedList.length - 1)]
                                    .initialSeed
                                : 0xdead,
                            16
                        ),
                    });
                }
            } catch (err) {
                console.error("Failed to fetch seeds for", game, err);
                setSeedList([]);
            }
        };
        fetchSeedList();
    }, [game, sound, buttonMode, button, heldButton, isFRLG]);

    const targetSeedIndex = useMemo(
        () =>
            seedList.findIndex((seed) => seed.initialSeed === targetSeedValue),
        [seedList, targetSeedValue]
    );

    const targetSeed: FRLGContiguousSeedEntry =
        targetSeedIndex === -1
            ? { initialSeed: 0xdead, seedTime: 0 }
            : seedList[targetSeedIndex];

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (isNotSubmittable) return;
        const searchSeeds = seedList.slice(
            Math.max(0, targetSeedIndex - seedLeeway),
            Math.min(seedList.length, targetSeedIndex + seedLeeway + 1)
        );
        const submit = async () => {
            const tenLines = await fetchTenLines();
            setRows([]);
            setSearching(true);
            if (isStatic) {
                await tenLines.check_seeds_static(
                    searchSeeds,
                    advancesRange,
                    ttvAdvancesRange,
                    parseInt(offset),
                    SEED_IDENTIFIER_TO_GAME[game],
                    parseInt(trainerID),
                    parseInt(secretID),
                    calibrationFormState.staticCategory,
                    calibrationFormState.staticPokemon,
                    calibrationFormState.method,
                    calibrationFormState.shininess,
                    calibrationFormState.nature,
                    calibrationFormState.gender,
                    ivRanges,
                    proxy((results: ExtendedGeneratorState[]) => {
                        setRows((rows) => {
                            if (rows.length > 1000 || results.length === 0) {
                                return rows;
                            }
                            return [...rows, ...results];
                        });
                    }),
                    proxy(setSearching)
                );
            } else {
                await tenLines.check_seeds_wild(
                    searchSeeds,
                    advancesRange,
                    ttvAdvancesRange,
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
                    calibrationFormState.shininess,
                    calibrationFormState.nature,
                    calibrationFormState.gender,
                    ivRanges,
                    proxy((results: ExtendedWildGeneratorState[]) => {
                        setRows((rows) => {
                            if (rows.length > 1000 || results.length === 0) {
                                return rows;
                            }
                            return [...rows, ...results];
                        });
                    }),
                    proxy(setSearching)
                );
            }
        };
        submit();
    };

    const targetSeedFilterOptions = useMemo(() => {
        return (
            options: FRLGContiguousSeedEntry[],
            state: {
                inputValue: string;
                getOptionLabel: (opt: FRLGContiguousSeedEntry) => string;
            }
        ): FRLGContiguousSeedEntry[] => {
            if (options.length === 0) return [];

            const leeway =
                seedLeewayIsValid && seedLeeway > 0 ? seedLeeway : 20;

            const currentLabel =
                targetSeed && targetSeed.initialSeed !== 0xdead
                    ? `${hexSeed(targetSeed.initialSeed, 16)} (${frameToMS(
                          targetSeed.seedTime / 16,
                          gameConsole
                      )}ms)`
                    : "";

            const rawInput = state.inputValue.trim();

            if (
                !rawInput ||
                (currentLabel &&
                    rawInput.toLowerCase() === currentLabel.toLowerCase())
            ) {
                const centerIndex =
                    targetSeedIndex !== -1 ? targetSeedIndex : 0;
                const start = Math.max(0, centerIndex - leeway);
                const end = Math.min(
                    options.length,
                    centerIndex + leeway + 1
                );
                return options.slice(start, end);
            }

            const cleanInput = rawInput
                .toLowerCase()
                .replace(/\s*ms$/i, "")
                .replace(/^0x/i, "");

            const isNumeric = /^\d+$/.test(cleanInput);
            const numericVal = isNumeric ? parseInt(cleanInput, 10) : NaN;

            const isMsSearch =
                (/ms$/i.test(rawInput) && isNumeric) ||
                (isNumeric && numericVal >= 10000);

            if (isMsSearch) {
                let closestIndex = 0;
                let minDiff = Infinity;
                for (let i = 0; i < options.length; i++) {
                    const ms = frameToMS(
                        options[i].seedTime / 16,
                        gameConsole
                    );
                    const diff = Math.abs(ms - numericVal);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestIndex = i;
                    }
                }
                const start = Math.max(0, closestIndex - leeway);
                const end = Math.min(
                    options.length,
                    closestIndex + leeway + 1
                );
                return options.slice(start, end);
            }

            const matches: FRLGContiguousSeedEntry[] = [];
            for (const opt of options) {
                const hex = hexSeed(opt.initialSeed, 16).toLowerCase();
                const ms = frameToMS(opt.seedTime / 16, gameConsole).toString();
                if (hex.includes(cleanInput) || ms.includes(cleanInput)) {
                    matches.push(opt);
                    if (matches.length >= 100) break;
                }
            }
            return matches;
        };
    }, [seedLeewayIsValid, seedLeeway, targetSeed, gameConsole, targetSeedIndex]);

    useEffect(() => {
        if (calibrationFormState.staticCategory === 3 && !isFRLG) {
            setCalibrationFormState((prev) => ({ ...prev, staticCategory: 0 }));
        } else if (calibrationFormState.staticCategory === 6 && !isFRLGE) {
            setCalibrationFormState((prev) => ({ ...prev, staticCategory: 0 }));
        } else if (calibrationFormState.staticCategory === 8 && isFRLG) {
            setCalibrationFormState((prev) => ({ ...prev, staticCategory: 0 }));
        }
    }, [isFRLG, isFRLGE, calibrationFormState.staticCategory, setCalibrationFormState]);

    if (hidden) {
        return null;
    }

    return (
        <Box component="form" onSubmit={handleSubmit} sx={sx}>
            <GameConsoleSelector
                game={game}
                gameConsole={gameConsole}
                onGameChange={(newGame) => {
                    setGame(newGame);
                }}
                onConsoleChange={(newConsole) => {
                    setGameConsole(newConsole);
                }}
            />
            {isFRLG && (
                <React.Fragment>
                    <TextField
                        label="Sound"
                        margin="normal"
                        style={{ textAlign: "left" }}
                        onChange={(event) =>
                            setCalibrationURLState({
                                sound: event.target.value,
                            })
                        }
                        value={sound}
                        select
                        fullWidth
                    >
                        <MenuItem value="mono">Mono</MenuItem>
                        <MenuItem value="stereo">Stereo</MenuItem>
                    </TextField>
                    <TextField
                        label="Button Mode"
                        margin="normal"
                        style={{ textAlign: "left" }}
                        onChange={(event) =>
                            setCalibrationURLState({
                                buttonMode: event.target.value,
                            })
                        }
                        value={buttonMode}
                        select
                        fullWidth
                    >
                        <MenuItem value="a">L=A</MenuItem>
                        <MenuItem value="h">Help</MenuItem>
                        <MenuItem value="r">LR</MenuItem>
                    </TextField>
                    <TextField
                        label="Seed Button"
                        margin="normal"
                        style={{ textAlign: "left" }}
                        onChange={(event) =>
                            setCalibrationURLState({
                                button: event.target.value,
                            })
                        }
                        value={button}
                        select
                        fullWidth
                    >
                        <MenuItem value="a">A</MenuItem>
                        <MenuItem value="start">Start</MenuItem>
                        <MenuItem value="l">L (L=A)</MenuItem>
                    </TextField>
                    <TextField
                        label="Extra Button"
                        margin="normal"
                        style={{ textAlign: "left" }}
                        onChange={(event) =>
                            setCalibrationURLState({
                                heldButton: event.target.value,
                            })
                        }
                        value={heldButton}
                        select
                        fullWidth
                    >
                        <MenuItem value="none">None</MenuItem>
                        <MenuItem value="startup_select">
                            Startup Select
                        </MenuItem>
                        <MenuItem value="startup_a">Startup A</MenuItem>
                        <MenuItem value="blackout_r">Blackout R</MenuItem>
                        <MenuItem value="blackout_a">Blackout A</MenuItem>
                        <MenuItem value="blackout_l">Blackout L</MenuItem>
                        <MenuItem value="blackout_al">Blackout A+L</MenuItem>
                    </TextField>
                </React.Fragment>
            )}
            <Autocomplete
                options={seedList}
                value={targetSeed}
                onChange={(_event, newValue) => {
                    if (newValue) {
                        setCalibrationURLState({
                            targetInitialSeed: hexSeed(newValue.initialSeed, 16),
                        });
                    }
                }}
                isOptionEqualToValue={(option, value) =>
                    option.initialSeed === value?.initialSeed
                }
                getOptionLabel={(item_) => {
                    const item = item_ as FRLGContiguousSeedEntry;
                    return `${hexSeed(item.initialSeed, 16)} (${frameToMS(
                        item.seedTime / 16,
                        gameConsole
                    )}ms)`;
                }}
                filterOptions={targetSeedFilterOptions}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label="Target Seed"
                        margin="normal"
                        error={seedList.length === 0}
                        helperText={
                            seedList.length === 0
                                ? "No known seeds for this game & settings"
                                : undefined
                        }
                    />
                )}
                disablePortal
                disableClearable
                selectOnFocus
                fullWidth
            />
            <Box sx={{ flexDirection: "row", display: "flex" }}>
                <NumericalInput
                    label="Seed +/-"
                    margin="normal"
                    onChange={(_event, value) => {
                        setCalibrationFormState((data) => ({
                            ...data,
                            seedLeewayString: value.value,
                        }));
                        setSeedLeewayIsValid(value.isValid);
                    }}
                    value={calibrationFormState.seedLeewayString}
                    minimumValue={0}
                    maximumValue={10000}
                    isHex={false}
                    name="seedLeeway"
                />
                <Button
                    sx={{ my: 2 }}
                    size="small"
                    variant="contained"
                    color="primary"
                    onClick={() => {
                        setSeedDialogOpen(true);
                    }}
                >
                    Show Seeds
                </Button>
                <Dialog
                    open={seedDialogOpen}
                    onClose={() => {
                        setSeedDialogOpen(false);
                    }}
                >
                    <DialogContent sx={{ minWidth: 150, textAlign: "center" }}>
                        <Box>
                            {seedList
                                .slice(
                                    Math.max(targetSeedIndex - seedLeeway, 0),
                                    Math.min(
                                        targetSeedIndex + seedLeeway + 1,
                                        seedList.length
                                    )
                                )
                                .map((seed, i) => (
                                    <div key={i}>
                                        {hexSeed(seed.initialSeed, 16)}
                                    </div>
                                ))}
                        </Box>
                    </DialogContent>
                </Dialog>
            </Box>
            <RangeInput
                label={isTeachyTVMode ? "Final A Press Frame" : "Advances"}
                name="advancesRange"
                onChange={(_event, value) => {
                    setCalibrationURLState({
                        advancesMin: value.value[0],
                        advancesMax: value.value[1],
                    });
                    setAdvancesRangeIsValid(value.isValid);
                }}
                value={[advancesMin, advancesMax]}
                minimumValue={0}
                maximumValue={4294967295}
            />
            <NumericalInput
                label="Offset"
                name="offset"
                minimumValue={0}
                maximumValue={4294967295}
                onChange={(_, value) => {
                    setCalibrationURLState({
                        offset: value.value,
                    });
                    setOffsetIsValid(value.isValid);
                }}
                value={offset}
            ></NumericalInput>
            {isTeachyTVMode && (
                <RangeInput
                    label="TeachyTV Advances"
                    name="ttvRange"
                    onChange={(_event, value) => {
                        setCalibrationURLState({
                            ttvAdvancesMin: value.value[0],
                            ttvAdvancesMax: value.value[1],
                        });
                        setTTVAdvancesRangeIsValid(value.isValid);
                    }}
                    value={[ttvAdvancesMin, ttvAdvancesMax]}
                    minimumValue={0}
                    maximumValue={4294967295}
                />
            )}
            {isSwitch && (<NumericalInput
                label="Required Overworld Frames"
                name="overworldFrames"
                minimumValue={0}
                maximumValue={4294967295}
                onChange={(_, value) => {
                    setCalibrationURLState({
                        overworldFrames: value.value,
                    });
                    setOverworldFramesIsValid(value.isValid);
                }}
                value={overworldFrames}
            ></NumericalInput>)}
            {isFRLG && !isSwitch && (
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={isTeachyTVMode}
                            onChange={(e) => {
                                setCalibrationURLState({
                                    teachyTVMode: e.target.checked.toString(),
                                });
                            }}
                        />
                    }
                    label="TeachyTV Mode"
                />
            )}
            <Box sx={{ flexDirection: "row", display: "flex" }}>
                <NumericalInput
                    label="Trainer ID"
                    margin="normal"
                    onChange={(_event, value) => {
                        setTrainerID(value.value);
                        setTrainerIDIsValid(value.isValid);
                    }}
                    value={trainerID}
                    minimumValue={0}
                    maximumValue={65535}
                    isHex={false}
                    name="trainerID"
                />
                <span
                    style={{
                        margin: "0 10px",
                        alignSelf: "center",
                    }}
                >
                    /
                </span>
                <NumericalInput
                    label="Secret ID"
                    margin="normal"
                    onChange={(_event, value) => {
                        setSecretID(value.value);
                        setSecretIDIsValid(value.isValid);
                    }}
                    value={secretID}
                    minimumValue={0}
                    maximumValue={65535}
                    isHex={false}
                    name="secretID"
                />
            </Box>
            <TextField
                label="Method"
                margin="normal"
                style={{ textAlign: "left" }}
                onChange={(event) => {
                    setCalibrationFormState((data) => ({
                        ...data,
                        method: parseInt(event.target.value),
                    }));
                }}
                value={calibrationFormState.method}
                select
                fullWidth
            >
                {Object.entries(METHODS_EN)
                    .filter(([value, _name]) => parseInt(value) != STATIC_2)
                    .map(([value, name], index) => (
                        <MenuItem key={index} value={parseInt(value)}>
                            {name}
                        </MenuItem>
                    ))}
            </TextField>
            {isStatic && (
                <StaticEncounterSelector
                    staticCategory={calibrationFormState.staticCategory}
                    staticPokemon={calibrationFormState.staticPokemon}
                    game={SEED_IDENTIFIER_TO_GAME[game]}
                    onChange={(staticCategory, staticPokemon) => {
                        setCalibrationFormState((data) => ({
                            ...data,
                            staticCategory,
                            staticPokemon,
                        }));
                    }}
                />
            )}
            {!isStatic && (
                <WildEncounterSelector
                    wildCategory={calibrationFormState.wildCategory}
                    wildLocation={calibrationFormState.wildLocation}
                    wildPokemon={calibrationFormState.wildPokemon}
                    wildLead={calibrationFormState.wildLead}
                    shouldFilterPokemon={
                        calibrationFormState.shouldFilterPokemon
                    }
                    game={SEED_IDENTIFIER_TO_GAME[game]}
                    onChange={(
                        wildCategory,
                        wildLocation,
                        wildPokemon,
                        wildLead,
                        shouldFilterPokemon
                    ) => {
                        setCalibrationFormState((data) => ({
                            ...data,
                            wildCategory,
                            wildLocation,
                            wildPokemon,
                            wildLead,
                            shouldFilterPokemon,
                        }));
                    }}
                />
            )}
            <TextField
                label="Shininess"
                margin="normal"
                style={{ textAlign: "left" }}
                onChange={(event) => {
                    setCalibrationFormState((data) => ({
                        ...data,
                        shininess: parseInt(event.target.value),
                    }));
                }}
                value={calibrationFormState.shininess}
                select
                fullWidth
            >
                <MenuItem value="255">Any</MenuItem>
                <MenuItem value="1">Star</MenuItem>
                <MenuItem value="2">Square</MenuItem>
                <MenuItem value="3">Star/Square</MenuItem>
            </TextField>
            <TextField
                label="Nature"
                margin="normal"
                style={{ textAlign: "left" }}
                onChange={(event) => {
                    setCalibrationFormState((data) => ({
                        ...data,
                        nature: parseInt(event.target.value),
                    }));
                }}
                value={calibrationFormState.nature}
                helperText="Required for IV calculation"
                select
                fullWidth
            >
                <MenuItem value="-1">Any</MenuItem>
                {NATURES_EN.map((nature, index) => (
                    <MenuItem key={index} value={index}>
                        {nature}
                    </MenuItem>
                ))}
            </TextField>
            <TextField
                label="Gender"
                margin="normal"
                style={{ textAlign: "left" }}
                onChange={(event) => {
                    setCalibrationFormState((data) => ({
                        ...data,
                        gender: parseInt(event.target.value),
                    }));
                }}
                value={calibrationFormState.gender}
                select
                fullWidth
            >
                <MenuItem value="255">Any</MenuItem>
                {GENDERS_EN.slice(0, 2).map((gender, index) => (
                    <MenuItem key={index} value={index}>
                        {gender}
                    </MenuItem>
                ))}
            </TextField>
            {calibrationFormState.nature !== -1 ? (
                <React.Fragment>
                    <IvCalculator
                        onChange={(_event, value) => {
                            setCalibrationFormState((data) => ({
                                ...data,
                                ivCalculatorText: value.value,
                            }));
                            if (value.isValid) {
                                setCalibrationFormState((data) => ({
                                    ...data,
                                    ivRangeStrings: value.calculatedValue.map(
                                        (ivRange) => [
                                            ivRange.min.toString(),
                                            ivRange.max.toString(),
                                        ]
                                    ),
                                }));
                            }
                        }}
                        calculateIVs={async (parsedLines) => {
                            const tenLines = await fetchTenLines();
                            if (isStatic) {
                                return await tenLines.calc_ivs_static(
                                    calibrationFormState.staticCategory,
                                    calibrationFormState.staticPokemon,
                                    parsedLines,
                                    calibrationFormState.nature
                                );
                            }
                            return await tenLines.calc_ivs_generic(
                                calibrationFormState.wildPokemon & 0x7ff,
                                calibrationFormState.wildPokemon >> 11,
                                parsedLines,
                                calibrationFormState.nature
                            );
                        }}
                        value={calibrationFormState.ivCalculatorText}
                    />
                    <IvEntry
                        onChange={(_event, value) => {
                            setIvRangesAreValid(value.isValid);
                            setCalibrationFormState((data) => ({
                                ...data,
                                ivRangeStrings: value.value,
                            }));
                        }}
                        value={calibrationFormState.ivRangeStrings}
                    />
                </React.Fragment>
            ) : (
                <span>IV Calculation disabled. Searching all Natures.</span>
            )}
            {bingoActive && (
                <>
                    <Button
                        variant="contained"
                        color="secondary"
                        type="button"
                        disabled={isNotSubmittable || bingoLoading}
                        onClick={async () => {
                            if (isNotSubmittable) return;
                            setBingoLoading(true);
                            setBingoSuccess(false);
                            try {
                                const rawSeeds = seedList.slice(
                                    Math.max(0, targetSeedIndex - seedLeeway),
                                    Math.min(
                                        seedList.length,
                                        targetSeedIndex + seedLeeway + 1
                                    )
                                );
                                const seenSeeds = new Set<number>();
                                const searchSeeds: FRLGContiguousSeedEntry[] = [];
                                for (const s of rawSeeds) {
                                    if (!seenSeeds.has(s.initialSeed)) {
                                        seenSeeds.add(s.initialSeed);
                                        searchSeeds.push(s);
                                    }
                                }
                                await fetchBingo(
                                    searchSeeds,
                                    advancesRange,
                                    offset,
                                    isStatic,
                                    trainerID,
                                    secretID,
                                    game,
                                    calibrationFormState,
                                    setBingoBoard,
                                    setBingoCounters
                                );
                                setBingoMetadata({
                                    game,
                                    gameConsole,
                                    createdAt: Date.now(),
                                });
                                setBingoSuccess(true);
                            } finally {
                                setBingoLoading(false);
                            }
                        }}
                        fullWidth
                        sx={{ my: 0.5, fontWeight: 700 }}
                    >
                        {bingoLoading ? "Generando Tablero Bingo..." : "🎯 Generate Bingo Board"}
                    </Button>
                    {bingoSuccess && (
                        <Box
                            sx={{
                                my: 1,
                                p: 1.5,
                                bgcolor: "rgba(16, 185, 129, 0.15)",
                                border: "1px solid #10b981",
                                borderRadius: 1.5,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: 1,
                            }}
                        >
                            <span style={{ fontSize: "0.9rem", color: "#34d399", fontWeight: 600 }}>
                                ✅ ¡Tablero de Bingo generado con éxito!
                            </span>
                            <Button
                                size="small"
                                variant="contained"
                                color="success"
                                onClick={() => {
                                    setSearchParams((prev) => {
                                        prev.set("page", "3");
                                        return prev;
                                    });
                                }}
                            >
                                Ver Tablero Bingo →
                            </Button>
                        </Box>
                    )}
                </>
            )}
            <Button
                variant="contained"
                color="primary"
                type="submit"
                disabled={isNotSubmittable}
                sx={{ my: 0.5 }}
                fullWidth
            >
                {searching ? "Searching..." : "Submit"}
            </Button>
            <CalibrationTable
                rows={rows}
                target={targetSeed}
                gameConsole={gameConsole}
                isStatic={isStatic}
                isTeachyTVMode={isTeachyTVMode}
                isSwitch={isSwitch}
                overworldFrames={overworldFramesIsValid ? parseInt(overworldFrames) : 0}
                isMultiMethod={
                    calibrationFormState.method == COMBINED_WILD_METHOD
                }
            />
        </Box>
    );
}
