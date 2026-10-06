import "./App.css";

import CssBaseline from "@mui/material/CssBaseline";
import { createTheme, ThemeProvider } from "@mui/material/styles";

import InitialSeedForm from "./components/InitialSeedForm";
import SearcherForm from "./components/SearcherForm";
import { Box, Tab, Tabs } from "@mui/material";
import CalibrationForm from "./components/CalibrationForm";
import FrLgSeedsTimestamp from "./wasm/src/generated/frlg_seeds_timestamp.txt?raw";
import { BrowserRouter, useSearchParams } from "react-router-dom";
import BingoPage, { getBingoActive } from "./components/BingoPage";

const darkTheme = createTheme({
    palette: {
        mode: "dark",
        primary: {
            main: "#38bdf8",
            contrastText: "#0b0f17",
        },
        secondary: {
            main: "#f472b6",
            contrastText: "#0b0f17",
        },
        background: {
            default: "#0b0f17",
            paper: "#161f2e",
        },
        success: {
            main: "#34d399",
        },
    },
    typography: {
        fontFamily: [
            "-apple-system",
            "BlinkMacSystemFont",
            '"Segoe UI"',
            "Roboto",
            '"Helvetica Neue"',
            "Arial",
            "sans-serif",
        ].join(","),
    },
    shape: {
        borderRadius: 8,
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: "none",
                    fontWeight: 600,
                },
            },
        },
        MuiTab: {
            styleOverrides: {
                root: {
                    textTransform: "none",
                    fontWeight: 600,
                    fontSize: "0.95rem",
                },
            },
        },
    },
});

function TenLinesPages() {
    const [searchParams, setSearchParams] = useSearchParams();
    const currentPage = parseInt(searchParams.get("page") || "0") ?? 0;
    const bingoActive = getBingoActive();

    const isBingoPage = currentPage === 3;

    const formSx = {
        maxWidth: isBingoPage
            ? { xs: "100%", sm: "99%", md: "98%", xl: "96%" }
            : { xs: "100%", sm: 960, md: 1240, lg: 1540, xl: 1960 },
        width: "100%",
        mx: "auto",
        px: { xs: 0.5, sm: 1.5, md: 2 },
    };

    const pages = [
        <InitialSeedForm
            key={0}
            sx={formSx}
            hidden={currentPage != 0}
        />,
        <CalibrationForm
            key={1}
            sx={formSx}
            hidden={currentPage != 1}
        />,
        <SearcherForm
            key={2}
            sx={formSx}
            hidden={currentPage != 2}
        />,
        bingoActive && (
            <BingoPage
                key={3}
                sx={formSx}
                hidden={currentPage != 3}
            />
        ),
    ];

    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <Box
                sx={{
                    width: "100%",
                    maxWidth: isBingoPage
                        ? { xs: "100%", sm: "99%", md: "98%", xl: "96%" }
                        : { xs: "100%", sm: 980, md: 1280, lg: 1580, xl: 2000 },
                    mx: "auto",
                    transition: "max-width 0.25s ease-in-out",
                }}
            >
                {/* Header Branded */}
                <Box
                    sx={{
                        mb: 2.5,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 1.5,
                    }}
                >
                    <img
                        src="icon-180x180.png"
                        alt="Ten Lines"
                        style={{ width: 40, height: 40, borderRadius: 8 }}
                    />
                    <Box sx={{ textAlign: "left" }}>
                        <div
                            style={{
                                fontSize: "1.3rem",
                                fontWeight: 700,
                                lineHeight: 1.2,
                                letterSpacing: "-0.01em",
                            }}
                        >
                            Ten Lines
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                            Gen 3 RNG Manipulation Suite
                        </div>
                    </Box>
                </Box>

                {/* Navigation Tabs */}
                <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
                    <Tabs
                        value={currentPage}
                        onChange={(_, newValue) => {
                            setSearchParams((prev) => {
                                prev.set("page", newValue.toString());
                                return prev;
                            });
                        }}
                        variant="scrollable"
                        scrollButtons="auto"
                        allowScrollButtonsMobile
                        sx={{
                            "& .MuiTabs-flexContainer": {
                                justifyContent: { sm: "center", xs: "flex-start" },
                            },
                        }}
                    >
                        <Tab label="Searcher" value={2} />
                        <Tab label="Initial Seed" value={0} />
                        <Tab label="Calibration" value={1} />
                        {bingoActive && <Tab label="🎯 Bingo" value={3} />}
                    </Tabs>
                </Box>

                {/* Page Content */}
                {pages}
            </Box>

            <footer>
                Original "10 lines" was created by Shao, FRLG seeds farmed by
                blisy, po, HunarPG, 10Ben, Real96, ColdStoneSys, Papa Jef&eacute;, and トノ
                <br />
                Powered by{" "}
                <a href="https://github.com/Admiral-Fish/PokeFinder" target="_blank" rel="noreferrer">
                    PokeFinderCore
                </a>
                <br />
                FRLG seed data as of {FrLgSeedsTimestamp}
            </footer>
        </ThemeProvider>
    );
}

function App() {
    return (
        <BrowserRouter>
            <TenLinesPages />
        </BrowserRouter>
    );
}

export default App;
