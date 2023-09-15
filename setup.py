import setuptools

with open("README.md", "r") as fh:
    long_description = fh.read()

setuptools.setup(
    name="funtime", 
    version="0.0.1",
    author="Austin Emmitt",
    author_email="alkali@alkalinesecurity.com",
    description="A Objective-C runtime tracing tool using frida",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/aemmitt-ns/funtime",
    packages=setuptools.find_packages(),
    scripts=['bin/funtime'],
    package_data={'funtime': ['funtime.js']},
    include_package_data=True,
    python_requires='>=3.6',
    install_requires=[
        'frida',
        'rich'
    ]
)
