cmake_minimum_required(VERSION 3.22.1)
project(jarvis_llm C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Solo la librería de llama.cpp: sin herramientas, servidor ni ejemplos.
set(LLAMA_BUILD_COMMON   OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TESTS    OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TOOLS    OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_SERVER   OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_APP      OFF CACHE BOOL "" FORCE)
set(LLAMA_OPENSSL        OFF CACHE BOOL "" FORCE)
set(LLAMA_ALL_WARNINGS   OFF CACHE BOOL "" FORCE)
set(BUILD_SHARED_LIBS    OFF CACHE BOOL "" FORCE)
set(GGML_NATIVE          OFF CACHE BOOL "" FORCE)
set(GGML_OPENMP          ON  CACHE BOOL "" FORCE)
set(GGML_CPU_KLEIDIAI    OFF CACHE BOOL "" FORCE)
# Visión: solo la librería mtmd de llama.cpp (sin video ni herramientas)
set(LLAMA_BUILD_MTMD     ON  CACHE BOOL "" FORCE)
set(MTMD_VIDEO           OFF CACHE BOOL "" FORCE)
set(LLAMA_SUBPROCESS     OFF CACHE BOOL "" FORCE)

# llama.cpp se descarga (versión fija) en el paso de compilación: ver .github/workflows/jarvis-apk.yml
add_subdirectory(${CMAKE_CURRENT_LIST_DIR}/llama.cpp build-llama)

add_library(jarvis_llm SHARED jarvis_llm.cpp)
target_link_libraries(jarvis_llm llama mtmd)
target_include_directories(jarvis_llm PRIVATE ${CMAKE_CURRENT_LIST_DIR}/llama.cpp/tools/mtmd)
if(ANDROID)
  target_link_libraries(jarvis_llm android log)
endif()
