import { proxy } from "comlink";
import { useState } from "react";

import { Box, Button } from "@mui/material";

import fetchTenLines, { fetchSeedData, hexSeed } from "../tenLines";
import NumericalInput from "./NumericalInput";
import InitialSeedTable from "./InitialSeedTable";
import type { InitialSeedResult } from "../tenLines/generated";
import { useSearchParams } from "react-router-dom";
import TeachyTVEntry from "./TeachyTVEntry";
import useGameSettings from "../hooks/useGameSettings";
import GameConsoleSelector from "./GameConsoleSelector";

export interface InitialSeedFormState {
    targetSeedIsValid: boolean;
    countIsValid: boolean;
    offsetIsValid: boolean;
}

export interface InitialSeedURLState {
    targetSeed: string;
    count: string;
    offset: string;
    teachyTVMode: string;
    teachyTVRegularOut: string;
}

function useInitialSeedURLState() {
    const [searchParams, setSearchParams] = useSearchParams();
    const targetSeed = searchParams.get("targetSeed") || "DEADBEEF";
    const count = searchParams.get("count") || "10";
    const offset = searchParams.get("offset") || "0";
    const teachyTVMode = searchParams.get("teachyTVMode") || "false";
    const teachyTVRegularOut = searchParams.get("teachyTVRegularOut") || "3600";
    const setInitialSeedURLState = (state: Partial<InitialSeedURLState>) => {
        setSearchParams((prev) => {
            for (const [key, value] of Object.entries(state)) {
                prev.set(key, value);
            }
            return prev;
        });
    };
    return {
        targetSeed,
        count,
        offset,
        teachyTVMode,
        teachyTVRegularOut,
        setInitialSeedURLState,
    };
}

export default function TenLinesForm({
    sx,
    hidden,
}: {
    sx?: any;
    hidden?: boolean;
}) {
    const [initialSeedFormState, setInitialSeedFormState] =
        useState<InitialSeedFormState>({
            targetSeedIsValid: true,
            countIsValid: true,
            offsetIsValid: true,
        });
    const {
        targetSeed,
        count,
        offset,
        teachyTVMode,
        teachyTVRegularOut,
        setInitialSeedURLState,
    } = useInitialSeedURLState();
    const {
        game,
        gameConsole,
        isSwitch,
        isFRLG,
        setGame,
        setGameConsole,
    } = useGameSettings();
    const [data, setData] = useState<InitialSeedResult[]>([]);
    const isNotSubmittable =
        !initialSeedFormState.targetSeedIsValid ||
        !initialSeedFormState.countIsValid ||
        !initialSeedFormState.offsetIsValid;
    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (isNotSubmittable) return;
        fetchTenLines().then((lib) => {
            setData([]);
            if (!isFRLG) {
                lib.ten_lines_painting(
                    parseInt(targetSeed, 16),
                    parseInt(count, 10),
                    parseInt(offset, 10),
                    proxy(setData)
                );
            } else {
                fetchSeedData(game).then((data) => {
                    lib.ten_lines_frlg(
                        parseInt(targetSeed, 16),
                        parseInt(count, 10),
                        parseInt(offset, 10),
                        game,
                        isTeachyTVMode
                            ? parseInt(teachyTVRegularOut, 10) ?? 0
                            : 0,
                        data,
                        proxy(setData)
                    );
                });
            }
        });
    };

    const isTeachyTVMode = teachyTVMode === "true" && isFRLG;

    if (hidden) {
        return null;
    }

    return (
        <Box component="form" onSubmit={handleSubmit} sx={sx}>
            <NumericalInput
                label="Target Seed"
                name="targetSeed"
                minimumValue={0}
                maximumValue={0xffffffff}
                isHex={true}
                onChange={(_, value) => {
                    setInitialSeedURLState({
                        targetSeed: value.isValid
                            ? hexSeed(parseInt(value.value, 16), 32)
                            : value.value,
                    });
                    setInitialSeedFormState((data) => ({
                        ...data,
                        targetSeedIsValid: value.isValid,
                    }));
                }}
                value={targetSeed}
            ></NumericalInput>
            <NumericalInput
                label="Result Count"
                name="resultCount"
                minimumValue={0}
                maximumValue={5000}
                onChange={(_, value) => {
                    setInitialSeedURLState({
                        count: value.value,
                    });
                    setInitialSeedFormState((data) => ({
                        ...data,
                        countIsValid: value.isValid,
                    }));
                }}
                value={count}
            ></NumericalInput>
            <NumericalInput
                label="Offset"
                name="offset"
                minimumValue={0}
                maximumValue={4294967295}
                onChange={(_, value) => {
                    setInitialSeedURLState({
                        offset: value.value,
                    });
                    setInitialSeedFormState((data) => ({
                        ...data,
                        offsetIsValid: value.isValid,
                    }));
                }}
                value={offset}
            ></NumericalInput>
            <GameConsoleSelector
                game={game}
                gameConsole={gameConsole}
                onGameChange={(newGame) => {
                    setGame(newGame);
                    setData([]);
                }}
                onConsoleChange={(newConsole) => {
                    setGameConsole(newConsole);
                }}
            />
            {isFRLG && !isSwitch && (
                <TeachyTVEntry
                    isTeachyTVMode={isTeachyTVMode}
                    teachyTVRegularOut={teachyTVRegularOut}
                    onChange={(isTeachyTVMode, teachyTVRegularOut) => {
                        setInitialSeedURLState({
                            teachyTVMode: isTeachyTVMode.toString(),
                            teachyTVRegularOut: teachyTVRegularOut.value,
                        });
                    }}
                ></TeachyTVEntry>
            )}
            <Button
                variant="contained"
                color="primary"
                type="submit"
                disabled={isNotSubmittable}
                fullWidth
            >
                Submit
            </Button>
            <InitialSeedTable
                rows={data}
                game={game}
                isFRLG={isFRLG}
                gameConsole={gameConsole}
                isTeachyTVMode={isTeachyTVMode}
                teachyTVRegularOut={parseInt(teachyTVRegularOut, 10) ?? 0}
            />
        </Box>
    );
}
