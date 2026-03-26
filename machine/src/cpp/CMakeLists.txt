cmake_minimum_required(VERSION 3.15)
project(memory_manager)

execute_process(
  COMMAND poetry env info --executable
  OUTPUT_VARIABLE Python3_EXECUTABLE
  OUTPUT_STRIP_TRAILING_WHITESPACE
)

execute_process(
  COMMAND poetry run python -c "import pybind11; print(pybind11.get_cmake_dir())"
  OUTPUT_VARIABLE pybind11_DIR
  OUTPUT_STRIP_TRAILING_WHITESPACE
)

find_package(Python3 REQUIRED COMPONENTS Interpreter Development)
find_package(pybind11 REQUIRED)

pybind11_add_module(memory_manager memory-manager.cpp)